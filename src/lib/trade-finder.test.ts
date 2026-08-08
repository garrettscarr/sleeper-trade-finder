import {
  findTradePackages,
  packageTradeValue,
  starsToTradeValue,
  type AssetRef,
  type ValueMaps,
} from "./trade-finder";

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
assert(Math.abs(top.partnerDelta) / top.partnerReceiveTotal <= 0.15, "top deal partner-fair");
assert(top.youReceiveTotal > top.youGiveTotal, "you should like receiving Pickens");

// Elite premium: 5★ >> two 2nds (2.0★ each)
const bowersTv = packageTradeValue([5.0]);
const twoSecondsTv = packageTradeValue([2.0, 2.0]);
assert(bowersTv > 2.2 * starsToTradeValue(3.5), "5★ should be multiple mid-1sts");
assert(twoSecondsTv < 0.45 * bowersTv, "two 2nds must not approach a 5★");

const bowers: AssetRef = { kind: "player", id: "bowers", label: "Brock Bowers", position: "TE" };
const secondA: AssetRef = { kind: "pick", id: "2a", label: "2026 2nd", position: "PICK" };
const secondB: AssetRef = { kind: "pick", id: "2b", label: "2027 2nd", position: "PICK" };
const firstA: AssetRef = { kind: "pick", id: "1a", label: "2026 1st", position: "PICK" };
const firstB: AssetRef = { kind: "pick", id: "1b", label: "2027 1st", position: "PICK" };
const firstC: AssetRef = { kind: "pick", id: "1c", label: "2028 1st", position: "PICK" };

const eliteValues: ValueMaps = {
  partner: new Map([
    ["player:bowers", 5.0],
    ["pick:2a", 2.0],
    ["pick:2b", 2.0],
    ["pick:1a", 3.5],
    ["pick:1b", 3.5],
    ["pick:1c", 3.5],
  ]),
  you: new Map([
    ["player:bowers", 5.0],
    ["pick:2a", 2.0],
    ["pick:2b", 2.0],
    ["pick:1a", 3.5],
    ["pick:1b", 3.5],
    ["pick:1c", 3.5],
  ]),
  community: new Map([
    ["player:bowers", 5.0],
    ["pick:2a", 2.0],
    ["pick:2b", 2.0],
    ["pick:1a", 3.5],
    ["pick:1b", 3.5],
    ["pick:1c", 3.5],
  ]),
};

const junkForElite = findTradePackages({
  yourAssets: [secondA, secondB],
  wantAssets: [bowers],
  values: eliteValues,
  fairnessBand: 0.2,
  maxGiveAssets: 2,
});
assert(junkForElite.length === 0, "two 2nds must not fair-match Bowers");

const firstsForElite = findTradePackages({
  yourAssets: [firstA, firstB, firstC],
  wantAssets: [bowers],
  values: eliteValues,
  fairnessBand: 0.2,
  maxGiveAssets: 3,
});
assert(
  firstsForElite.some((p) => p.give.filter((g) => g.kind === "pick").length >= 2),
  "Bowers should require multiple firsts (or equivalent)",
);

console.log("trade-finder.test.ts passed");
