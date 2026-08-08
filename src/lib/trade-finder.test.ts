import { findTradePackages, type AssetRef, type ValueMaps } from "./trade-finder";

function assert(cond: unknown, msg: string) {
  if (!cond) throw new Error(msg);
}

const pickens: AssetRef = {
  kind: "player",
  id: "pickens",
  label: "George Pickens",
  position: "WR",
};
const wr2: AssetRef = {
  kind: "player",
  id: "wr2",
  label: "Your WR2",
  position: "WR",
};
const rb: AssetRef = {
  kind: "player",
  id: "rb",
  label: "Your RB",
  position: "RB",
};

const values: ValueMaps = {
  partner: new Map([
    ["player:pickens", 3.5],
    ["player:wr2", 3.5],
    ["player:rb", 2.0],
  ]),
  you: new Map([
    ["player:pickens", 4.5], // you love Pickens vs baseline
    ["player:wr2", 3.0],
    ["player:rb", 2.0],
  ]),
  community: new Map([
    ["player:pickens", 3.5],
    ["player:wr2", 3.5],
    ["player:rb", 2.0],
  ]),
};

const proposals = findTradePackages({
  yourAssets: [wr2, rb],
  wantAssets: [pickens],
  values,
  fairnessBand: 0.15,
  maxGiveAssets: 2,
});

assert(proposals.length > 0, "expected at least one proposal");
assert(
  proposals.some((p) => p.give.length === 1 && p.give[0].id === "wr2"),
  "expected 1-for-1 WR2 for Pickens fair to partner",
);

const top = proposals[0];
assert(Math.abs(top.partnerDelta) <= 0.5, "top deal should be partner-fair in stars");
assert(top.youReceiveTotal > top.youGiveTotal, "you should like receiving Pickens");

console.log("trade-finder.test.ts passed");
