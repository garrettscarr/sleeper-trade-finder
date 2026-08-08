export type AssetRef = {
  kind: "player" | "pick";
  id: string; // playerId or pickId
  sleeperId?: string;
  /** Original team owner avatar for draft picks. */
  sleeperAvatarId?: string | null;
  label: string;
  position?: string | null;
};

export type ValueMaps = {
  partner: Map<string, number>;
  you: Map<string, number>;
  community: Map<string, number>;
};

export type TradeProposal = {
  give: AssetRef[];
  receive: AssetRef[];
  partnerGiveTotal: number;
  partnerReceiveTotal: number;
  youGiveTotal: number;
  youReceiveTotal: number;
  communityGiveTotal: number;
  communityReceiveTotal: number;
  partnerDelta: number;
  youDelta: number;
  reason: string;
};

function assetKey(a: AssetRef): string {
  return `${a.kind}:${a.id}`;
}

function sumValues(assets: AssetRef[], map: Map<string, number>): number {
  return assets.reduce((acc, a) => acc + (map.get(assetKey(a)) ?? 0), 0);
}

function combinations<T>(arr: T[], size: number): T[][] {
  if (size === 0) return [[]];
  if (arr.length < size) return [];
  const result: T[][] = [];
  const helper = (start: number, path: T[]) => {
    if (path.length === size) {
      result.push([...path]);
      return;
    }
    for (let i = start; i < arr.length; i++) {
      path.push(arr[i]);
      helper(i + 1, path);
      path.pop();
    }
  };
  helper(0, []);
  return result;
}

function formatAssets(assets: AssetRef[]): string {
  return assets.map((a) => a.label).join(" + ");
}

export function findTradePackages(input: {
  yourAssets: AssetRef[];
  wantAssets: AssetRef[];
  values: ValueMaps;
  fairnessBand: number; // 0.05 = 5%
  maxGiveAssets: number;
  topK?: number;
}): TradeProposal[] {
  const { yourAssets, wantAssets, values, fairnessBand, maxGiveAssets } = input;
  const topK = input.topK ?? 25;

  const target = sumValues(wantAssets, values.partner);
  if (target <= 0 || wantAssets.length === 0) return [];

  const low = target * (1 - fairnessBand);
  const high = target * (1 + fairnessBand);

  const candidates: TradeProposal[] = [];

  for (let size = 1; size <= maxGiveAssets; size++) {
    for (const give of combinations(yourAssets, size)) {
      const partnerGive = sumValues(give, values.partner);
      if (partnerGive < low || partnerGive > high) continue;

      const partnerReceive = target;
      const youGive = sumValues(give, values.you);
      const youReceive = sumValues(wantAssets, values.you);
      const communityGive = sumValues(give, values.community);
      const communityReceive = sumValues(wantAssets, values.community);

      const partnerDelta = partnerGive - partnerReceive;
      const youDelta = youReceive - youGive;

      const wantLabel = formatAssets(wantAssets);
      const giveLabel = formatAssets(give);
      const fmt = (n: number) => `${n.toFixed(1)}★`;
      const yourView =
        youDelta >= -0.25
          ? `you also like this (${fmt(youReceive)} vs ${fmt(youGive)} on your board)`
          : `stretch for you (${fmt(youReceive)} vs ${fmt(youGive)} on your board)`;

      candidates.push({
        give,
        receive: wantAssets,
        partnerGiveTotal: partnerGive,
        partnerReceiveTotal: partnerReceive,
        youGiveTotal: youGive,
        youReceiveTotal: youReceive,
        communityGiveTotal: communityGive,
        communityReceiveTotal: communityReceive,
        partnerDelta,
        youDelta,
        reason: `Partner rates ${giveLabel} ≈ ${wantLabel}; ${yourView}.`,
      });
    }
  }

  candidates.sort((a, b) => {
    const aFair = Math.abs(a.partnerDelta);
    const bFair = Math.abs(b.partnerDelta);
    if (aFair !== bFair) return aFair - bFair;
    if (a.give.length !== b.give.length) return a.give.length - b.give.length;
    // Prefer deals that are not disastrous for you
    return Math.abs(Math.min(0, a.youDelta)) - Math.abs(Math.min(0, b.youDelta));
  });

  return candidates.slice(0, topK);
}

export function resolveValue(
  personal: number | undefined | null,
  baseline: number | undefined | null,
): number {
  if (personal != null && Number.isFinite(personal)) return personal;
  if (baseline != null && Number.isFinite(baseline)) return baseline;
  return 0;
}
