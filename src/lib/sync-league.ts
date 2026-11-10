import { prisma } from "./prisma";
import { applyPickOwnership, applyRosters } from "./roster-refresh";
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

  await applyRosters(league.id, rosters, users);
  await applyPickOwnership(
    league.id,
    Number(leagueData.season) || new Date().getFullYear(),
    tradedPicks,
  );

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
