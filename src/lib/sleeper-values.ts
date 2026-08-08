const STATS_BASE = "https://api.sleeper.com";

export type SleeperProjRow = {
  player_id: string;
  stats?: Record<string, number>;
  player?: { position?: string };
};

async function fetchJson<T>(url: string): Promise<T> {
  const res = await fetch(url, { next: { revalidate: 0 } });
  if (!res.ok) throw new Error(`Sleeper values API failed (${res.status}): ${url}`);
  return res.json() as Promise<T>;
}

export async function fetchSeasonProjections(
  season: string,
  positions: string[] = ["QB", "RB", "WR", "TE"],
): Promise<SleeperProjRow[]> {
  const rows: SleeperProjRow[] = [];
  for (const pos of positions) {
    const url = `${STATS_BASE}/projections/nfl/${season}?season_type=regular&position[]=${encodeURIComponent(pos)}`;
    try {
      const batch = await fetchJson<SleeperProjRow[]>(url);
      rows.push(...batch);
    } catch {
      // season may not have projections yet
    }
  }
  return rows;
}

export async function fetchSeasonStats(
  season: string,
  positions: string[] = ["QB", "RB", "WR", "TE"],
): Promise<SleeperProjRow[]> {
  const rows: SleeperProjRow[] = [];
  for (const pos of positions) {
    const url = `${STATS_BASE}/stats/nfl/${season}?season_type=regular&position[]=${encodeURIComponent(pos)}`;
    try {
      const batch = await fetchJson<SleeperProjRow[]>(url);
      rows.push(...batch);
    } catch {
      // ignore missing stats season
    }
  }
  return rows;
}

export type AdpProfile = "redraft_1qb" | "redraft_sf" | "dynasty_1qb" | "dynasty_sf";

export function resolveAdpProfile(opts: {
  scoringType: string;
  isDynasty: boolean;
}): AdpProfile {
  const sf = opts.scoringType === "SF";
  if (opts.isDynasty) return sf ? "dynasty_sf" : "dynasty_1qb";
  return sf ? "redraft_sf" : "redraft_1qb";
}

export function pickAdpField(profile: AdpProfile, scoringHint: "ppr" | "half" | "std" = "ppr"): string {
  switch (profile) {
    case "redraft_sf":
      return "adp_2qb";
    case "dynasty_sf":
      return "adp_dynasty_2qb";
    case "dynasty_1qb":
      if (scoringHint === "half") return "adp_dynasty_half_ppr";
      if (scoringHint === "std") return "adp_dynasty_std";
      return "adp_dynasty_ppr";
    case "redraft_1qb":
    default:
      if (scoringHint === "half") return "adp_half_ppr";
      if (scoringHint === "std") return "adp_std";
      return "adp_ppr";
  }
}

export function pickPointsField(scoringHint: "ppr" | "half" | "std" = "ppr"): string {
  if (scoringHint === "half") return "pts_half_ppr";
  if (scoringHint === "std") return "pts_std";
  return "pts_ppr";
}

export function scoringHintFromLeague(scoring?: Record<string, number>): "ppr" | "half" | "std" {
  const rec = scoring?.rec ?? 0;
  if (rec >= 0.9) return "ppr";
  if (rec >= 0.4) return "half";
  return "std";
}

export function detectDynasty(settings?: Record<string, number>): boolean {
  if (!settings) return false;
  if ((settings.type ?? 0) === 2) return true; // Sleeper dynasty-ish
  if ((settings.max_keepers ?? 0) > 0) return true;
  if ((settings.taxi_slots ?? 0) > 0) return true;
  return false;
}
