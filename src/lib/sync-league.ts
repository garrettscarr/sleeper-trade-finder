import { prisma } from "./prisma";
import { randomAccessCode } from "./session";
import {
  defaultPickValue,
  detectScoringType,
  fetchAllPlayers,
  fetchLeague,
  fetchLeagueRosters,
  fetchLeagueUsers,
  fetchTradedPicks,
  normalizeName,
  playerFullName,
} from "./sleeper";

export async function syncLeagueFromSleeper(opts: {
  sleeperLeagueId: string;
  existingLeagueId?: string;
}) {
  const { sleeperLeagueId, existingLeagueId } = opts;

  const [leagueData, users, rosters, tradedPicks] = await Promise.all([
    fetchLeague(sleeperLeagueId),
    fetchLeagueUsers(sleeperLeagueId),
    fetchLeagueRosters(sleeperLeagueId),
    fetchTradedPicks(sleeperLeagueId).catch(() => []),
  ]);

  const usersById = new Map(users.map((u) => [u.user_id, u]));
  const scoringType = detectScoringType(leagueData);

  const allPlayerIds = new Set<string>();
  for (const r of rosters) {
    for (const pid of r.players ?? []) allPlayerIds.add(pid);
  }

  const directory = await fetchAllPlayers();
  const neededIds = new Set<string>(allPlayerIds);
  for (const [id, p] of Object.entries(directory)) {
    if (neededIds.size >= 700) break;
    if (
      p.active &&
      p.position &&
      ["QB", "RB", "WR", "TE"].includes(p.position) &&
      !neededIds.has(id)
    ) {
      neededIds.add(id);
    }
  }

  for (const pid of neededIds) {
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
      update: {
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
    });
  }

  const league = existingLeagueId
    ? await prisma.league.update({
        where: { id: existingLeagueId },
        data: {
          name: leagueData.name,
          season: String(leagueData.season),
          scoringType,
          lastSyncedAt: new Date(),
        },
      })
    : await prisma.league.create({
        data: {
          sleeperLeagueId,
          name: leagueData.name,
          season: String(leagueData.season),
          scoringType,
          inviteCode: randomAccessCode(8),
          adminCode: randomAccessCode(8),
          lastSyncedAt: new Date(),
        },
      });

  for (const roster of rosters) {
    const user = roster.owner_id ? usersById.get(roster.owner_id) : undefined;
    const displayName = user?.display_name ?? `Roster ${roster.roster_id}`;
    const teamName = user?.metadata?.team_name ?? null;

    await prisma.team.upsert({
      where: {
        leagueId_sleeperRosterId: {
          leagueId: league.id,
          sleeperRosterId: roster.roster_id,
        },
      },
      create: {
        leagueId: league.id,
        sleeperRosterId: roster.roster_id,
        sleeperOwnerId: roster.owner_id,
        displayName,
        teamName,
        avatar: user?.avatar ?? null,
        playerIds: JSON.stringify(roster.players ?? []),
      },
      update: {
        sleeperOwnerId: roster.owner_id,
        displayName,
        teamName,
        avatar: user?.avatar ?? null,
        playerIds: JSON.stringify(roster.players ?? []),
      },
    });
  }

  const teams = await prisma.team.findMany({ where: { leagueId: league.id } });
  const teamByRoster = new Map(teams.map((t) => [t.sleeperRosterId, t]));
  const seasonNum = Number(leagueData.season) || new Date().getFullYear();
  const seasons = [String(seasonNum + 1), String(seasonNum + 2), String(seasonNum + 3)];

  type PickKey = string;
  const ownership = new Map<
    PickKey,
    { season: string; round: number; original: number; current: number }
  >();
  for (const season of seasons) {
    for (let round = 1; round <= 4; round++) {
      for (const t of teams) {
        const key = `${season}-${round}-${t.sleeperRosterId}`;
        ownership.set(key, {
          season,
          round,
          original: t.sleeperRosterId,
          current: t.sleeperRosterId,
        });
      }
    }
  }

  for (const tp of tradedPicks) {
    if (!seasons.includes(String(tp.season))) continue;
    if (tp.round < 1 || tp.round > 4) continue;
    const key = `${tp.season}-${tp.round}-${tp.roster_id}`;
    const existing = ownership.get(key);
    if (existing) {
      existing.current = tp.owner_id;
    }
  }

  for (const pick of ownership.values()) {
    const originalTeam = teamByRoster.get(pick.original);
    const label = `${pick.season} Round ${pick.round} (${originalTeam?.teamName || originalTeam?.displayName || `R${pick.original}`})`;
    await prisma.draftPick.upsert({
      where: {
        leagueId_season_round_originalRosterId: {
          leagueId: league.id,
          season: pick.season,
          round: pick.round,
          originalRosterId: pick.original,
        },
      },
      create: {
        leagueId: league.id,
        season: pick.season,
        round: pick.round,
        rosterId: pick.current,
        originalRosterId: pick.original,
        label,
      },
      update: {
        rosterId: pick.current,
        label,
      },
    });
  }

  const picks = await prisma.draftPick.findMany({ where: { leagueId: league.id } });
  for (const pick of picks) {
    await prisma.baselinePickValue.upsert({
      where: {
        leagueId_pickId: { leagueId: league.id, pickId: pick.id },
      },
      create: {
        leagueId: league.id,
        pickId: pick.id,
        value: defaultPickValue(pick.round),
      },
      update: {},
    });
  }

  return league;
}

export async function seedPersonalValuesForTeam(
  leagueId: string,
  teamId: string,
  opts: { overwrite?: boolean } = {},
) {
  const overwrite = opts.overwrite ?? false;
  const baselines = await prisma.baselineValue.findMany({ where: { leagueId } });
  for (const b of baselines) {
    await prisma.personalValue.upsert({
      where: { teamId_playerId: { teamId, playerId: b.playerId } },
      create: {
        leagueId,
        teamId,
        playerId: b.playerId,
        value: b.value,
        tier: "fair",
      },
      update: overwrite ? { value: b.value, tier: "fair" } : {},
    });
  }

  const pickBaselines = await prisma.baselinePickValue.findMany({ where: { leagueId } });
  for (const b of pickBaselines) {
    await prisma.personalPickValue.upsert({
      where: { teamId_pickId: { teamId, pickId: b.pickId } },
      create: {
        leagueId,
        teamId,
        pickId: b.pickId,
        value: b.value,
        tier: "fair",
      },
      update: overwrite ? { value: b.value, tier: "fair" } : {},
    });
  }
}
