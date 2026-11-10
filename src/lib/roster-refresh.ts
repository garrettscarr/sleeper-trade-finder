import { after } from "next/server";
import { prisma } from "./prisma";
import {
  defaultPickValue,
  fetchAllPlayers,
  fetchLeague,
  fetchLeagueRosters,
  fetchLeagueUsers,
  fetchTradedPicks,
  normalizeName,
  playerFullName,
  type SleeperRoster,
  type SleeperTradedPick,
  type SleeperUser,
} from "./sleeper";

/** How stale rosters may get before a page load pulls fresh ones from Sleeper. */
const ROSTER_MAX_AGE_MS = 10 * 60 * 1000;

export async function applyRosters(
  leagueId: string,
  rosters: SleeperRoster[],
  users: SleeperUser[],
) {
  const usersById = new Map(users.map((u) => [u.user_id, u]));
  for (const roster of rosters) {
    const user = roster.owner_id ? usersById.get(roster.owner_id) : undefined;
    const fields = {
      sleeperOwnerId: roster.owner_id,
      displayName: user?.display_name ?? `Roster ${roster.roster_id}`,
      teamName: user?.metadata?.team_name ?? null,
      avatar: user?.avatar ?? null,
      playerIds: JSON.stringify(roster.players ?? []),
      isCommissioner: Boolean(user?.is_owner),
    };
    await prisma.team.upsert({
      where: {
        leagueId_sleeperRosterId: { leagueId, sleeperRosterId: roster.roster_id },
      },
      create: { leagueId, sleeperRosterId: roster.roster_id, ...fields },
      update: fields,
    });
  }
}

/** Next three draft classes, rounds 1–4; only writes picks whose owner changed. */
export async function applyPickOwnership(
  leagueId: string,
  seasonNum: number,
  tradedPicks: SleeperTradedPick[],
) {
  const teams = await prisma.team.findMany({ where: { leagueId } });
  const teamByRoster = new Map(teams.map((t) => [t.sleeperRosterId, t]));
  const seasons = [seasonNum + 1, seasonNum + 2, seasonNum + 3].map(String);

  const ownership = new Map<
    string,
    { season: string; round: number; original: number; current: number }
  >();
  for (const season of seasons) {
    for (let round = 1; round <= 4; round++) {
      for (const t of teams) {
        ownership.set(`${season}-${round}-${t.sleeperRosterId}`, {
          season,
          round,
          original: t.sleeperRosterId,
          current: t.sleeperRosterId,
        });
      }
    }
  }
  for (const tp of tradedPicks) {
    const entry = ownership.get(`${tp.season}-${tp.round}-${tp.roster_id}`);
    if (entry) entry.current = tp.owner_id;
  }

  const existing = await prisma.draftPick.findMany({ where: { leagueId } });
  const existingByKey = new Map(
    existing.map((p) => [`${p.season}-${p.round}-${p.originalRosterId}`, p]),
  );

  for (const [key, pick] of ownership) {
    const originalTeam = teamByRoster.get(pick.original);
    const label = `${pick.season} Round ${pick.round} (${originalTeam?.teamName || originalTeam?.displayName || `R${pick.original}`})`;
    const prior = existingByKey.get(key);
    if (prior) {
      if (prior.rosterId !== pick.current || prior.label !== label) {
        await prisma.draftPick.update({
          where: { id: prior.id },
          data: { rosterId: pick.current, label },
        });
      }
      continue;
    }
    const created = await prisma.draftPick.create({
      data: {
        leagueId,
        season: pick.season,
        round: pick.round,
        rosterId: pick.current,
        originalRosterId: pick.original,
        label,
      },
    });
    await prisma.baselinePickValue.upsert({
      where: { leagueId_pickId: { leagueId, pickId: created.id } },
      create: { leagueId, pickId: created.id, value: defaultPickValue(pick.round) },
      update: {},
    });
  }
}

/** Add players who joined a roster but aren't in our player table yet. */
async function addMissingPlayers(rosters: SleeperRoster[]): Promise<number> {
  const rostered = new Set<string>();
  for (const r of rosters) for (const id of r.players ?? []) rostered.add(id);
  if (rostered.size === 0) return 0;
  const known = await prisma.player.findMany({
    where: { sleeperPlayerId: { in: [...rostered] } },
    select: { sleeperPlayerId: true },
  });
  const knownIds = new Set(known.map((p) => p.sleeperPlayerId));
  const missing = [...rostered].filter((id) => !knownIds.has(id));
  if (missing.length === 0) return 0;

  const directory = await fetchAllPlayers();
  for (const pid of missing) {
    const p = directory[pid];
    if (!p) continue;
    const fullName = playerFullName(p);
    await prisma.player.upsert({
      where: { sleeperPlayerId: pid },
      create: {
        sleeperPlayerId: pid,
        fullName,
        firstName: p.first_name ?? null,
        lastName: p.last_name ?? null,
        position: p.position ?? null,
        nflTeam: p.team ?? null,
        status: p.status ?? null,
        age: typeof p.age === "number" ? p.age : null,
        yearsExp: typeof p.years_exp === "number" ? p.years_exp : null,
        searchName: normalizeName(fullName),
      },
      update: {},
    });
  }
  return missing.length;
}

/** Light sync: rosters, managers, and pick ownership. Skips the full player directory. */
export async function refreshRosters(leagueId: string) {
  const league = await prisma.league.findUnique({ where: { id: leagueId } });
  if (!league) return { addedPlayers: 0 };
  const [leagueData, users, rosters, tradedPicks] = await Promise.all([
    fetchLeague(league.sleeperLeagueId),
    fetchLeagueUsers(league.sleeperLeagueId),
    fetchLeagueRosters(league.sleeperLeagueId),
    fetchTradedPicks(league.sleeperLeagueId).catch(() => []),
  ]);
  const addedPlayers = await addMissingPlayers(rosters);
  await applyRosters(leagueId, rosters, users);
  await applyPickOwnership(
    leagueId,
    Number(leagueData.season) || new Date().getFullYear(),
    tradedPicks,
  );
  return { addedPlayers };
}

/**
 * Called on league page loads. At most one request per 10 minutes does the
 * refresh (the conditional update acts as a lock); everyone else skips.
 */
export async function ensureFreshRosters(leagueId: string) {
  const now = new Date();
  const cutoff = new Date(now.getTime() - ROSTER_MAX_AGE_MS);
  const claimed = await prisma.league.updateMany({
    where: {
      id: leagueId,
      OR: [{ lastSyncedAt: null }, { lastSyncedAt: { lt: cutoff } }],
    },
    data: { lastSyncedAt: now },
  });
  if (claimed.count === 0) return;

  try {
    const { addedPlayers } = await refreshRosters(leagueId);
    if (addedPlayers > 0) {
      // New players need market ★; that's slow, so finish it after the response.
      after(async () => {
        const { recomputeStarBaselines } = await import("./baseline");
        await recomputeStarBaselines(leagueId).catch(() => undefined);
      });
    }
  } catch {
    // Sleeper hiccup: keep showing the last good rosters; retry on a later visit.
  }
}
