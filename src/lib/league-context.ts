import type { SleeperLeague } from "./sleeper";
import { detectDynasty, scoringHintFromLeague } from "./sleeper-values";

export type StarterDemand = {
  QB: number;
  RB: number;
  WR: number;
  TE: number;
  FLEX: number;
  SUPER_FLEX: number;
};

export type LeagueValueContext = {
  isDynasty: boolean;
  isSuperflex: boolean;
  scoringHint: "ppr" | "half" | "std";
  /** Extra points per TE reception (0 = no TEP). */
  tePremium: number;
  /** Multiplier applied to TE projected/actual points before ranking. */
  tePointsMultiplier: number;
  starters: StarterDemand;
  /**
   * Relative scarcity by position (1.0 = normal). Higher = scarcer starters
   * relative to typical 1QB league shape.
   */
  scarcity: Record<"QB" | "RB" | "WR" | "TE", number>;
  labels: string[];
};

function countSlots(positions: string[]): StarterDemand {
  const starters: StarterDemand = {
    QB: 0,
    RB: 0,
    WR: 0,
    TE: 0,
    FLEX: 0,
    SUPER_FLEX: 0,
  };
  for (const p of positions) {
    if (p === "QB") starters.QB += 1;
    else if (p === "RB") starters.RB += 1;
    else if (p === "WR") starters.WR += 1;
    else if (p === "TE") starters.TE += 1;
    else if (p === "FLEX" || p === "WRRB_FLEX" || p === "REC_FLEX") starters.FLEX += 1;
    else if (p === "SUPER_FLEX") starters.SUPER_FLEX += 1;
  }
  return starters;
}

/**
 * Detect TE premium from Sleeper scoring.
 * Common keys: bonus_rec_te (0.5 / 1.0), sometimes higher TE reception scoring.
 */
export function detectTePremium(scoring?: Record<string, number>): number {
  if (!scoring) return 0;
  const bonus = scoring.bonus_rec_te ?? scoring.bonus_te_rec ?? 0;
  if (bonus > 0) return bonus;
  // Some leagues use a higher TE catch value than WR
  const rec = scoring.rec ?? 0;
  const teRec = scoring.te_rec ?? scoring.rec_te;
  if (teRec != null && teRec > rec) return teRec - rec;
  return 0;
}

export function tePointsMultiplierFromPremium(tePremium: number): number {
  if (tePremium <= 0) return 1;
  if (tePremium >= 1.5) return 1.45;
  if (tePremium >= 1) return 1.3;
  if (tePremium >= 0.5) return 1.18;
  return 1.1;
}

/**
 * Scarcity vs a typical 1QB / 2RB / 2WR / 1TE / 1FLEX league.
 * SUPER_FLEX increases QB scarcity; extra TE/FLEX TE demand increases TE scarcity.
 */
export function scarcityFromStarters(starters: StarterDemand): LeagueValueContext["scarcity"] {
  const typical = { QB: 1, RB: 2.5, WR: 2.5, TE: 1.2 };
  // FLEX spreads demand; assume 40% RB / 45% WR / 15% TE
  const flexRb = starters.FLEX * 0.4;
  const flexWr = starters.FLEX * 0.45;
  const flexTe = starters.FLEX * 0.15;
  const qbDemand = starters.QB + starters.SUPER_FLEX;
  const rbDemand = starters.RB + flexRb;
  const wrDemand = starters.WR + flexWr;
  const teDemand = starters.TE + flexTe;

  const clamp = (n: number) => Math.min(1.8, Math.max(0.75, n));
  return {
    QB: clamp(qbDemand / typical.QB),
    RB: clamp(rbDemand / typical.RB),
    WR: clamp(wrDemand / typical.WR),
    TE: clamp(teDemand / typical.TE),
  };
}

export function buildLeagueValueContext(
  league: SleeperLeague,
  scoringType: string,
): LeagueValueContext {
  const starters = countSlots(league.roster_positions ?? []);
  const isSuperflex = scoringType === "SF" || starters.SUPER_FLEX > 0;
  const tePremium = detectTePremium(league.scoring_settings);
  const scarcity = scarcityFromStarters(starters);
  // Explicit TE starter slots increase TE scarcity beyond flex bleed
  if (starters.TE >= 2) scarcity.TE = Math.min(1.8, scarcity.TE + 0.25);
  if (tePremium > 0) scarcity.TE = Math.min(1.8, scarcity.TE + 0.15 + tePremium * 0.1);

  const labels: string[] = [];
  if (detectDynasty(league.settings)) labels.push("dynasty");
  else labels.push("redraft");
  labels.push(isSuperflex ? "superflex" : "1QB");
  if (tePremium > 0) labels.push(`TEP(+${tePremium})`);
  if (scarcity.TE >= 1.25) labels.push("TE-scarce");
  if (scarcity.QB >= 1.25) labels.push("QB-scarce");

  return {
    isDynasty: detectDynasty(league.settings),
    isSuperflex,
    scoringHint: scoringHintFromLeague(league.scoring_settings),
    tePremium,
    tePointsMultiplier: tePointsMultiplierFromPremium(tePremium),
    starters,
    scarcity,
    labels,
  };
}
