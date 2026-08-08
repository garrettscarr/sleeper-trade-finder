import { prisma } from "./prisma";
import {
  adpPoolToStarMap,
  blendStars,
  pointsPoolToStarMap,
  pickRoundToStars,
  seasonProgress,
  clampStars,
} from "./stars";
import {
  fetchSeasonProjections,
  fetchSeasonStats,
  pickAdpField,
  pickPointsField,
  resolveAdpProfile,
} from "./sleeper-values";
import { buildLeagueValueContext } from "./league-context";
import { applyValueAdjustments } from "./value-adjusters";
import { fetchLeague, fetchNflState } from "./sleeper";
import { seedPersonalValuesForTeam } from "./sync-league";

export async function recomputeStarBaselines(leagueId: string) {
  const league = await prisma.league.findUnique({ where: { id: leagueId } });
  if (!league) throw new Error("League not found");

  const sleeperLeague = await fetchLeague(league.sleeperLeagueId);
  const state = await fetchNflState();
  const ctx = buildLeagueValueContext(sleeperLeague, league.scoringType);
  const profile = resolveAdpProfile({
    scoringType: league.scoringType,
    isDynasty: ctx.isDynasty,
  });
  const adpField = pickAdpField(profile, ctx.scoringHint);
  const ptsField = pickPointsField(ctx.scoringHint);

  const projSeason = String(state.league_season || state.season);
  const prevSeason = String(state.previous_season || Number(projSeason) - 1);

  let projections = await fetchSeasonProjections(projSeason);
  let usedProjSeason = projSeason;
  if (projections.length === 0) {
    projections = await fetchSeasonProjections(prevSeason);
    usedProjSeason = prevSeason;
  }

  const inSeason =
    state.season_type === "regular" || state.season_type === "post";
  const week = inSeason ? Number(state.week || state.display_week || 0) : 0;
  const progress = seasonProgress(week);
  const useActuals = inSeason && week > 0;

  let statsSeason = projSeason;
  let stats: Awaited<ReturnType<typeof fetchSeasonStats>> = [];
  if (useActuals) {
    stats = await fetchSeasonStats(statsSeason);
    if (stats.length === 0) {
      statsSeason = prevSeason;
      stats = await fetchSeasonStats(statsSeason);
    }
  }

  const adpByPlayer = new Map<string, number>();
  const projPtsByPlayer = new Map<string, number>();
  for (const row of projections) {
    if (!row.player_id || !row.stats) continue;
    const adp = row.stats[adpField];
    if (adp != null && adp > 0 && adp < 900) adpByPlayer.set(row.player_id, adp);
    let pts = row.stats[ptsField];
    if (pts != null && pts > 0) {
      const pos = row.player?.position?.toUpperCase();
      if (pos === "TE" && ctx.tePointsMultiplier > 1) {
        pts *= ctx.tePointsMultiplier;
      }
      projPtsByPlayer.set(row.player_id, pts);
    }
  }

  const actualPtsByPlayer = new Map<string, number>();
  for (const row of stats) {
    if (!row.player_id || !row.stats) continue;
    let pts = row.stats[ptsField];
    if (pts != null && pts > 0) {
      const pos = row.player?.position?.toUpperCase();
      if (pos === "TE" && ctx.tePointsMultiplier > 1) {
        pts *= ctx.tePointsMultiplier;
      }
      actualPtsByPlayer.set(row.player_id, pts);
    }
  }

  const adpStars = adpPoolToStarMap(adpByPlayer);
  const projStars = pointsPoolToStarMap(projPtsByPlayer, {
    maxRanked: 250,
    minPoints: 40,
  });
  const actualStars = useActuals
    ? pointsPoolToStarMap(actualPtsByPlayer, { maxRanked: 250, minPoints: 20 })
    : new Map<string, number>();

  const teams = await prisma.team.findMany({
    where: { leagueId },
    select: { playerIds: true },
  });
  const rosterSleeperIds = new Set<string>();
  for (const t of teams) {
    for (const id of JSON.parse(t.playerIds || "[]") as string[]) {
      rosterSleeperIds.add(id);
    }
  }

  const players = await prisma.player.findMany({
    where:
      rosterSleeperIds.size > 0
        ? { sleeperPlayerId: { in: [...rosterSleeperIds] } }
        : undefined,
    select: {
      id: true,
      sleeperPlayerId: true,
      fullName: true,
      position: true,
      age: true,
      yearsExp: true,
    },
  });

  let updated = 0;
  const samples: {
    name: string;
    stars: number;
    base: number;
    deltas: { age: number; tePremium: number; scarcity: number };
  }[] = [];

  for (const player of players) {
    const sid = player.sleeperPlayerId;
    const base = blendStars({
      adp: adpStars.get(sid) ?? null,
      proj: projStars.get(sid) ?? null,
      actual: actualStars.get(sid) ?? null,
      progress,
      useActuals,
    });

    const adjusted = applyValueAdjustments({
      baseStars: base,
      position: player.position,
      age: player.age,
      yearsExp: player.yearsExp,
      ctx,
    });

    await prisma.baselineValue.upsert({
      where: {
        leagueId_playerId: { leagueId, playerId: player.id },
      },
      create: { leagueId, playerId: player.id, value: adjusted.stars },
      update: { value: adjusted.stars },
    });
    updated += 1;

    if (
      /nabers|bowers|zaccheaus|zaccheus|slayton|chase|jefferson|mcbride|kelce/i.test(
        player.fullName,
      )
    ) {
      samples.push({
        name: player.fullName,
        stars: adjusted.stars,
        base,
        deltas: adjusted.deltas,
      });
    }
  }

  const picks = await prisma.draftPick.findMany({ where: { leagueId } });
  const currentSeasonNum = Number(projSeason) || new Date().getFullYear();
  for (const pick of picks) {
    const yearsOut = Math.max(0, Number(pick.season) - currentSeasonNum);
    // Dynasty future picks keep more value; redraft near-term slightly higher
    const dynastyBump = ctx.isDynasty ? 0.5 : 0;
    const stars = clampStars(
      pickRoundToStars(pick.round) - yearsOut * (ctx.isDynasty ? 0.25 : 0.5) + dynastyBump,
    );
    await prisma.baselinePickValue.upsert({
      where: { leagueId_pickId: { leagueId, pickId: pick.id } },
      create: { leagueId, pickId: pick.id, value: stars },
      update: { value: stars },
    });
  }

  await prisma.league.update({
    where: { id: leagueId },
    data: {
      baselineSource: `stars:${profile}:${adpField}+${ptsField} [${ctx.labels.join(", ")}] (${usedProjSeason}, week ${week || 0})`,
      scoringType: league.scoringType === "SF" || ctx.isSuperflex ? "SF" : league.scoringType,
    },
  });

  const claimed = await prisma.team.findMany({
    where: { leagueId, claimToken: { not: null } },
  });
  for (const team of claimed) {
    await seedPersonalValuesForTeam(leagueId, team.id, { overwrite: true });
  }

  return {
    updated,
    profile,
    adpField,
    ptsField,
    projSeason: usedProjSeason,
    statsSeason: useActuals ? statsSeason : null,
    week,
    progress,
    useActuals,
    context: {
      labels: ctx.labels,
      tePremium: ctx.tePremium,
      tePointsMultiplier: ctx.tePointsMultiplier,
      scarcity: ctx.scarcity,
      isDynasty: ctx.isDynasty,
    },
    samples,
  };
}
