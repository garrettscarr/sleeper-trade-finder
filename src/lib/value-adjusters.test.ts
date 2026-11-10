import { buildLeagueValueContext } from "./league-context";
import { ageStarDelta, applyValueAdjustments, tePremiumStarDelta } from "./value-adjusters";
import type { SleeperLeague } from "./sleeper";

function assert(cond: unknown, msg: string) {
  if (!cond) throw new Error(msg);
}

const tepLeague = {
  league_id: "1",
  name: "TEP",
  season: "2026",
  total_rosters: 12,
  roster_positions: ["QB", "RB", "RB", "WR", "WR", "TE", "FLEX", "SUPER_FLEX"],
  scoring_settings: { rec: 1, bonus_rec_te: 1 },
  settings: { type: 2, max_keepers: 0, taxi_slots: 1 },
} satisfies SleeperLeague;

const ctx = buildLeagueValueContext(tepLeague, "SF");
assert(ctx.tePremium === 1, "detect 1pt TEP");
assert(ctx.tePointsMultiplier >= 1.25, "TE points boosted");
assert(ctx.isDynasty, "dynasty detected");
assert(ctx.scarcity.TE > 1, "TE scarce in TEP/SF");
assert(ctx.scarcity.QB > 1, "QB scarce in SF");

const bowersBase = 4.0;
const bowers = applyValueAdjustments({
  baseStars: bowersBase,
  position: "TE",
  age: 23,
  ctx,
});
assert(bowers.deltas.tePremium >= 0.75, "elite TE gets TEP bump");
assert(bowers.deltas.age >= 0.25, "young TE dynasty age bump");
assert(bowers.stars >= 5.0, `Bowers should reach elite stars, got ${bowers.stars}`);

const depthTe = applyValueAdjustments({
  baseStars: 1.5,
  position: "TE",
  age: 29,
  ctx,
});
assert(depthTe.stars < bowers.stars - 1.5, "depth TE well below elite TEP");

assert(tePremiumStarDelta({ baseStars: 4, position: "WR", tePremium: 1 }) === 0, "TEP ignores WR");
assert(ageStarDelta({ age: 31, position: "RB", format: "dynasty" }) <= -0.5, "old RB ding");

// Redraft only cares about this season; keeper is halfway
assert(ageStarDelta({ age: 31, position: "RB", format: "redraft" }) === 0, "redraft ignores age");
assert(ageStarDelta({ age: 22, position: "WR", format: "redraft" }) === 0, "no youth bump in redraft");
assert(
  ageStarDelta({ age: 31, position: "RB", format: "keeper" }) ===
    ageStarDelta({ age: 31, position: "RB", format: "dynasty" }) / 2,
  "keeper = half the dynasty age curve",
);

// Sleeper leaves max_keepers at 1 in plain redraft leagues
const redraftLeague = {
  ...tepLeague,
  settings: { type: 0, max_keepers: 1, taxi_slots: 0 },
} satisfies SleeperLeague;
const keeperLeague = {
  ...tepLeague,
  settings: { type: 1, max_keepers: 3, taxi_slots: 0 },
} satisfies SleeperLeague;
const fullKeeperDynasty = {
  ...tepLeague,
  settings: { type: 1, max_keepers: 8, taxi_slots: 0 },
} satisfies SleeperLeague;
assert(buildLeagueValueContext(redraftLeague, "SF").format === "redraft", "redraft detected");
assert(buildLeagueValueContext(keeperLeague, "SF").format === "keeper", "keeper detected");
assert(
  buildLeagueValueContext(fullKeeperDynasty, "SF").format === "dynasty",
  "keep-everyone keeper counts as dynasty",
);

console.log("value-adjusters.test.ts passed");
