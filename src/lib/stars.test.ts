import { adpToStars, blendStars, pointsPoolToStarMap, rankToStars } from "./stars";

function assert(cond: unknown, msg: string) {
  if (!cond) throw new Error(msg);
}

assert(rankToStars(1) === 5.0, "rank 1 = 5★");
assert(rankToStars(10) === 4.0, "rank 10 = 4★");
assert(rankToStars(25) === 3.5, "rank 25 = 3.5★");
assert(adpToStars(27.3) === 3.5, "Nabers-ish ADP ~3.5★");
assert(adpToStars(3.4) === 5.0, "Chase-ish ADP = 5★");
assert(adpToStars(8.6) === 4.0, "dynasty Nabers-ish ADP = 4★");
assert(adpToStars(999) == null, "sentinel ADP ignored");

const pts = new Map<string, number>([
  ["chase", 311],
  ["nabers", 227],
  ["bowers", 253],
  ["slayton", 86],
  ["zaccheaus", 76],
]);
// pad with filler so slayton isn't artificially elite in a tiny pool
for (let i = 0; i < 80; i++) pts.set(`filler${i}`, 200 - i);

const stars = pointsPoolToStarMap(pts, { maxRanked: 250, minPoints: 40 });
assert((stars.get("chase") ?? 0) >= 4.5, "Chase proj stars elite");
assert((stars.get("nabers") ?? 0) >= 3.5, "Nabers still strong");
assert((stars.get("bowers") ?? 0) >= 3.5, "Bowers still strong");
assert((stars.get("slayton") ?? 0) <= 2.0, "Slayton depth");
assert((stars.get("zaccheaus") ?? 0) <= 2.0, "Zaccheaus depth");

const blendedElite = blendStars({
  adp: adpToStars(27.3),
  proj: stars.get("nabers") ?? null,
  actual: null,
  progress: 0,
  useActuals: false,
});
const blendedDepth = blendStars({
  adp: null,
  proj: stars.get("zaccheaus") ?? null,
  actual: null,
  progress: 0,
  useActuals: false,
});
assert(blendedElite >= 3.5, `elite blend ${blendedElite}`);
assert(blendedDepth <= 2.0, `depth blend ${blendedDepth}`);
assert(blendedElite - blendedDepth >= 1.0, "elite clearly above depth");

console.log("stars.test.ts passed");
