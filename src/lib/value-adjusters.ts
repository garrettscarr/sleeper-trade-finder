import { clampStars } from "./stars";
import type { LeagueValueContext } from "./league-context";

export type AdjustInput = {
  baseStars: number;
  position?: string | null;
  age?: number | null;
  yearsExp?: number | null;
  ctx: LeagueValueContext;
};

/**
 * Age curve: dynasty cares a lot; redraft mostly cares about RB decline.
 * Returns a star delta (can be negative).
 */
export function ageStarDelta(opts: {
  age?: number | null;
  yearsExp?: number | null;
  position?: string | null;
  isDynasty: boolean;
}): number {
  const pos = (opts.position || "").toUpperCase();
  const age =
    opts.age ??
    (opts.yearsExp != null ? 21 + opts.yearsExp : null);
  if (age == null || !Number.isFinite(age)) return 0;

  if (opts.isDynasty) {
    if (pos === "RB") {
      if (age <= 23) return 0.5;
      if (age <= 25) return 0.25;
      if (age <= 27) return 0;
      if (age <= 29) return -0.5;
      return -1.0;
    }
    if (pos === "QB") {
      if (age <= 26) return 0.5;
      if (age <= 30) return 0.25;
      if (age <= 33) return 0;
      if (age <= 36) return -0.25;
      return -0.75;
    }
    // WR / TE — longer runway
    if (age <= 24) return 0.5;
    if (age <= 26) return 0.25;
    if (age <= 28) return 0;
    if (age <= 30) return -0.25;
    if (age <= 32) return -0.5;
    return -1.0;
  }

  // Redraft: mild, RB-focused
  if (pos === "RB") {
    if (age <= 24) return 0.25;
    if (age >= 29) return -0.5;
    if (age >= 27) return -0.25;
    return 0;
  }
  if (age >= 33) return -0.25;
  return 0;
}

/**
 * TE premium: elite TEs jump more (Bowers-style) than replacement-level TEs.
 */
export function tePremiumStarDelta(opts: {
  baseStars: number;
  position?: string | null;
  tePremium: number;
}): number {
  if (opts.tePremium <= 0) return 0;
  if ((opts.position || "").toUpperCase() !== "TE") return 0;

  // 0.5 TEP → intensity 0.5; 1.0 TEP → 1.0; capped
  const intensity = Math.min(1.5, opts.tePremium);
  if (opts.baseStars >= 4.0) return Math.min(1.5, 1.0 * intensity);
  if (opts.baseStars >= 3.0) return Math.min(1.0, 0.5 * intensity + 0.25);
  if (opts.baseStars >= 2.0) return Math.min(0.5, 0.35 * intensity);
  return 0.25 * Math.min(1, intensity);
}

/**
 * Positional scarcity: scarce starter spots boost quality depth/elites at that position.
 */
export function scarcityStarDelta(opts: {
  baseStars: number;
  position?: string | null;
  scarcity: LeagueValueContext["scarcity"];
}): number {
  const pos = (opts.position || "").toUpperCase();
  if (pos !== "QB" && pos !== "RB" && pos !== "WR" && pos !== "TE") return 0;
  const s = opts.scarcity[pos];
  if (s <= 1.05) return 0;
  const over = s - 1;
  // Only meaningful players get scarcity premium (not 0.5★ dart throws)
  if (opts.baseStars < 1.5) return 0;
  if (opts.baseStars >= 3.5) return Math.min(0.75, over * 0.8);
  if (opts.baseStars >= 2.5) return Math.min(0.5, over * 0.55);
  return Math.min(0.25, over * 0.35);
}

export function applyValueAdjustments(input: AdjustInput): {
  stars: number;
  deltas: { age: number; tePremium: number; scarcity: number };
} {
  const age = ageStarDelta({
    age: input.age,
    yearsExp: input.yearsExp,
    position: input.position,
    isDynasty: input.ctx.isDynasty,
  });
  const tePremium = tePremiumStarDelta({
    baseStars: input.baseStars,
    position: input.position,
    tePremium: input.ctx.tePremium,
  });
  const scarcity = scarcityStarDelta({
    baseStars: input.baseStars,
    position: input.position,
    scarcity: input.ctx.scarcity,
  });

  return {
    stars: clampStars(input.baseStars + age + tePremium + scarcity),
    deltas: { age, tePremium, scarcity },
  };
}
