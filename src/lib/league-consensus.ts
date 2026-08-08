import { prisma } from "./prisma";
import { clampStars } from "./stars";

export type ConsensusStat = {
  /** Median of claimed managers' personal stars (null if nobody has rated). */
  value: number | null;
  /** How many claimed teams contributed a personal rating. */
  raters: number;
};

function median(values: number[]): number | null {
  if (values.length === 0) return null;
  const sorted = [...values].sort((a, b) => a - b);
  const mid = Math.floor(sorted.length / 2);
  if (sorted.length % 2 === 1) return clampStars(sorted[mid]);
  return clampStars((sorted[mid - 1] + sorted[mid]) / 2);
}

/**
 * Live league consensus from personal boards of claimed teams.
 * Updates automatically as managers save ratings — no separate "baseline" write.
 */
export async function getLeaguePlayerConsensus(
  leagueId: string,
  playerIds: string[],
): Promise<Map<string, ConsensusStat>> {
  const out = new Map<string, ConsensusStat>();
  if (playerIds.length === 0) return out;

  const claimedTeams = await prisma.team.findMany({
    where: { leagueId, claimToken: { not: null } },
    select: { id: true },
  });
  if (claimedTeams.length === 0) {
    for (const id of playerIds) out.set(id, { value: null, raters: 0 });
    return out;
  }

  const rows = await prisma.personalValue.findMany({
    where: {
      leagueId,
      playerId: { in: playerIds },
      teamId: { in: claimedTeams.map((t) => t.id) },
    },
    select: { playerId: true, value: true },
  });

  const bucket = new Map<string, number[]>();
  for (const id of playerIds) bucket.set(id, []);
  for (const row of rows) {
    bucket.get(row.playerId)?.push(row.value);
  }

  for (const [id, vals] of bucket) {
    out.set(id, { value: median(vals), raters: vals.length });
  }
  return out;
}

export async function getLeaguePickConsensus(
  leagueId: string,
  pickIds: string[],
): Promise<Map<string, ConsensusStat>> {
  const out = new Map<string, ConsensusStat>();
  if (pickIds.length === 0) return out;

  const claimedTeams = await prisma.team.findMany({
    where: { leagueId, claimToken: { not: null } },
    select: { id: true },
  });
  if (claimedTeams.length === 0) {
    for (const id of pickIds) out.set(id, { value: null, raters: 0 });
    return out;
  }

  const rows = await prisma.personalPickValue.findMany({
    where: {
      leagueId,
      pickId: { in: pickIds },
      teamId: { in: claimedTeams.map((t) => t.id) },
    },
    select: { pickId: true, value: true },
  });

  const bucket = new Map<string, number[]>();
  for (const id of pickIds) bucket.set(id, []);
  for (const row of rows) {
    bucket.get(row.pickId)?.push(row.value);
  }

  for (const [id, vals] of bucket) {
    out.set(id, { value: median(vals), raters: vals.length });
  }
  return out;
}
