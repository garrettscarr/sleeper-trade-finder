/** 2K-style star ratings: 0–5 in 0.5 steps. */

export const STAR_MIN = 0;
export const STAR_MAX = 5;
export const STAR_STEP = 0.5;

export function clampStars(n: number): number {
  if (!Number.isFinite(n)) return STAR_MIN;
  const clamped = Math.min(STAR_MAX, Math.max(STAR_MIN, n));
  return Math.round(clamped / STAR_STEP) * STAR_STEP;
}

export function nudgeStars(current: number, dir: 1 | -1): number {
  return clampStars(current + dir * STAR_STEP);
}

/**
 * Map an overall fantasy rank (1 = best) onto stars.
 * Tuned so true elites sit 4.5–5.0 and depth / unranked sit ≤ 2.0.
 */
export function rankToStars(rank: number | null | undefined): number | null {
  if (rank == null || !Number.isFinite(rank) || rank <= 0) return null;
  if (rank <= 3) return 5.0;
  if (rank <= 8) return 4.5;
  if (rank <= 16) return 4.0;
  if (rank <= 28) return 3.5;
  if (rank <= 45) return 3.0;
  if (rank <= 70) return 2.5;
  if (rank <= 100) return 2.0;
  if (rank <= 140) return 1.5;
  if (rank <= 200) return 1.0;
  if (rank <= 280) return 0.5;
  return 0.0;
}

/** ADP is already a rank-like number; clamp absurd sentinels. */
export function adpToStars(adp: number | null | undefined): number | null {
  if (adp == null || !Number.isFinite(adp) || adp <= 0 || adp >= 900) return null;
  return rankToStars(Math.max(1, Math.round(adp)));
}

/**
 * Convert a points map to stars by ranking only a fantasy-relevant pool.
 * Truncating the long tail prevents WR80s from looking like 4★ assets.
 */
export function pointsPoolToStarMap(
  pointsByPlayer: Map<string, number>,
  opts: { maxRanked?: number; minPoints?: number } = {},
): Map<string, number> {
  const maxRanked = opts.maxRanked ?? 250;
  const minPoints = opts.minPoints ?? 1;
  const entries = [...pointsByPlayer.entries()]
    .filter(([, pts]) => pts >= minPoints)
    .sort((a, b) => b[1] - a[1])
    .slice(0, maxRanked);

  const out = new Map<string, number>();
  entries.forEach(([id], idx) => {
    out.set(id, rankToStars(idx + 1) ?? 0);
  });
  // Anyone outside the relevant pool with some points → deep bench floor
  for (const [id, pts] of pointsByPlayer) {
    if (!out.has(id) && pts > 0) out.set(id, 0.5);
  }
  return out;
}

export function adpPoolToStarMap(adpByPlayer: Map<string, number>): Map<string, number> {
  const out = new Map<string, number>();
  for (const [id, adp] of adpByPlayer) {
    const stars = adpToStars(adp);
    if (stars != null) out.set(id, stars);
  }
  return out;
}

export function seasonProgress(week: number | null | undefined, totalWeeks = 17): number {
  if (week == null || !Number.isFinite(week) || week <= 0) return 0;
  return Math.min(1, Math.max(0, (week - 1) / totalWeeks));
}

/**
 * Early: ADP + projections dominate.
 * Later: actual scored points take over.
 * Preseason / week 0 should pass useActuals=false so last year doesn't distort.
 */
export function blendWeights(
  progress: number,
  useActuals = true,
): {
  adp: number;
  proj: number;
  actual: number;
} {
  const p = Math.min(1, Math.max(0, progress));
  let adp = 0.45 - 0.25 * p;
  let proj = 0.55 - 0.25 * p;
  let actual = useActuals ? 0.0 + 0.5 * p : 0;
  // Keep a little actual once the season has started
  if (useActuals && p > 0) actual = Math.max(actual, 0.08);
  const sum = adp + proj + actual;
  return { adp: adp / sum, proj: proj / sum, actual: actual / sum };
}

export function blendStars(parts: {
  adp: number | null;
  proj: number | null;
  actual: number | null;
  progress: number;
  useActuals?: boolean;
}): number {
  const useActuals = parts.useActuals ?? true;
  const w = blendWeights(parts.progress, useActuals);

  // When ADP + projections disagree, lean toward the stronger signal so
  // elites (great proj, merely good ADP) aren't crushed to depth-tier stars.
  let preActual: number | null = null;
  if (parts.adp != null && parts.proj != null) {
    const hi = Math.max(parts.adp, parts.proj);
    const lo = Math.min(parts.adp, parts.proj);
    preActual = 0.6 * hi + 0.4 * lo;
  } else if (parts.adp != null) {
    preActual = parts.adp;
  } else if (parts.proj != null) {
    preActual = parts.proj;
  }

  if (preActual == null && !(useActuals && parts.actual != null)) {
    return 0.5; // truly unranked floor
  }

  if (!useActuals || parts.actual == null || w.actual <= 0) {
    return clampStars(preActual ?? parts.actual ?? 0.5);
  }

  const preW = w.adp + w.proj;
  const score =
    (preActual != null ? preActual * preW : 0) + parts.actual * w.actual;
  const weight = (preActual != null ? preW : 0) + w.actual;
  return clampStars(score / weight);
}

export function pickRoundToStars(round: number): number {
  const table: Record<number, number> = {
    1: 3.5,
    2: 2.5,
    3: 1.5,
    4: 1.0,
    5: 0.5,
  };
  return table[round] ?? 0.5;
}

export function formatStars(n: number): string {
  return `${clampStars(n).toFixed(1)}★`;
}
