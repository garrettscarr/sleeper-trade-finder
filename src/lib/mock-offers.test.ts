import { generateMockOffers, offerTargets, type LabTeam } from "./mock-offers";
import { packageTradeValue, starsForPackageValue } from "./stars";

function assert(cond: unknown, msg: string) {
  if (!cond) throw new Error(msg);
}

const pick = (id: string, stars: number) => ({
  kind: "pick" as const,
  id,
  label: id,
  stars,
});
const player = (id: string, stars: number) => ({
  kind: "player" as const,
  id,
  label: id,
  stars,
});

const teams: LabTeam[] = [
  { teamId: "a", label: "A", assets: [pick("a1", 3.5), pick("a1b", 3.5), player("aw", 3.0), pick("a2", 2.0)] },
  { teamId: "b", label: "B", assets: [player("bstud", 4.5), pick("b1", 3.5), player("bdepth", 1.5)] },
  { teamId: "c", label: "C", assets: [player("cwr", 4.0), pick("c1", 3.5), pick("c1b", 3.5), pick("c2", 2.0)] },
];

const bowersTv = packageTradeValue([5.0]);
const targets = offerTargets({ referenceTv: bowersTv });
assert(targets.length === 4 && targets[0] < targets[3], "ascending ladder");

const offers = generateMockOffers({ teams, targets });
assert(offers.length >= 3, `expected several offers, got ${offers.length}`);
for (let i = 1; i < offers.length; i++) {
  assert(offers[i].tv >= offers[i - 1].tv, "offers sorted by value");
}
assert(
  offers.every((o) => o.assets.length >= 2 || o.assets[0].stars >= 4.5),
  "5★ offers need a stud or multiple real assets",
);
assert(new Set(offers.map((o) => o.teamId)).size >= 2, "offers spread across teams");

// Accepting an offer maps back to a sensible star rating
const mid = offers[Math.floor(offers.length / 2)];
const implied = starsForPackageValue(mid.tv);
assert(implied >= 4.5 && implied <= 5, `implied stars ${implied}`);

// "Need more" ladder sits above the rejected max
const higher = offerTargets({ referenceTv: bowersTv, low: offers[offers.length - 1].tv });
assert(higher[0] > offers[offers.length - 1].tv, "need-more round is higher");

console.log("mock-offers.test.ts passed");
