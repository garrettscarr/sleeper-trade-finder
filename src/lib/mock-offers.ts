import { packageTradeValue } from "./stars";

export type LabAsset = {
  kind: "player" | "pick";
  id: string;
  label: string;
  stars: number;
  sleeperPlayerId?: string;
  sleeperAvatarId?: string | null;
  position?: string | null;
};

export type LabTeam = {
  teamId: string;
  label: string;
  avatar?: string | null;
  assets: LabAsset[];
};

export type MockOffer = {
  teamId: string;
  teamLabel: string;
  teamAvatar: string | null;
  assets: LabAsset[];
  tv: number;
};

type Pkg = { team: LabTeam; assets: LabAsset[]; tv: number };

function combos<T>(arr: T[], maxSize: number): T[][] {
  const out: T[][] = [];
  const walk = (start: number, path: T[]) => {
    if (path.length > 0) out.push([...path]);
    if (path.length === maxSize) return;
    for (let i = start; i < arr.length; i++) {
      path.push(arr[i]);
      walk(i + 1, path);
      path.pop();
    }
  };
  walk(0, []);
  return out;
}

/**
 * Pick one realistic package per target trade value, spreading offers across
 * teams and assets so each round shows genuinely different deals.
 */
export function generateMockOffers(input: {
  teams: LabTeam[];
  targets: number[];
  maxAssets?: number;
  perTeamPool?: number;
  tolerance?: number;
}): MockOffer[] {
  const maxAssets = input.maxAssets ?? 3;
  const perTeamPool = input.perTeamPool ?? 14;
  const tolerance = input.tolerance ?? 0.12;

  const packages: Pkg[] = [];
  for (const team of input.teams) {
    // Sub-1★ filler can't move the needle on the nonlinear curve.
    const pool = team.assets
      .filter((a) => a.stars >= 1)
      .sort((a, b) => b.stars - a.stars)
      .slice(0, perTeamPool);
    for (const assets of combos(pool, maxAssets)) {
      packages.push({ team, assets, tv: packageTradeValue(assets.map((a) => a.stars)) });
    }
  }

  const usedTeams = new Set<string>();
  const usedAssets = new Set<string>();
  const offers: MockOffer[] = [];

  for (const target of input.targets) {
    if (!(target > 0)) continue;
    let best: Pkg | null = null;
    let bestScore = Infinity;
    for (const pkg of packages) {
      const err = Math.abs(pkg.tv - target) / target;
      if (err > tolerance) continue;
      const reused = pkg.assets.some((a) => usedAssets.has(`${a.kind}:${a.id}`));
      const score =
        err +
        0.05 * (pkg.assets.length - 1) +
        (usedTeams.has(pkg.team.teamId) ? 0.08 : 0) +
        (reused ? 0.25 : 0);
      if (score < bestScore) {
        bestScore = score;
        best = pkg;
      }
    }
    if (!best) continue;
    usedTeams.add(best.team.teamId);
    for (const a of best.assets) usedAssets.add(`${a.kind}:${a.id}`);
    offers.push({
      teamId: best.team.teamId,
      teamLabel: best.team.label,
      teamAvatar: best.team.avatar ?? null,
      assets: best.assets,
      tv: best.tv,
    });
  }

  return offers.sort((a, b) => a.tv - b.tv);
}

/** Target ladder for one calibration round, relative to current value or bounds. */
export function offerTargets(input: {
  referenceTv: number;
  low?: number | null;
  high?: number | null;
}): number[] {
  const { referenceTv, low, high } = input;
  if (low != null && high != null && high > low) {
    return [0.15, 0.38, 0.62, 0.85].map((f) => low + (high - low) * f);
  }
  if (low != null) return [1.12, 1.3, 1.5, 1.75].map((f) => low * f);
  if (high != null) return [0.88, 0.72, 0.56, 0.42].map((f) => high * f);
  return [0.72, 0.9, 1.08, 1.28].map((f) => referenceTv * f);
}
