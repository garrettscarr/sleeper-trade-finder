const BASE = "https://api.sleeper.app/v1";

export type SleeperLeague = {
  league_id: string;
  name: string;
  season: string;
  total_rosters: number;
  roster_positions?: string[];
  settings?: Record<string, number>;
  scoring_settings?: Record<string, number>;
};

export type SleeperUser = {
  user_id: string;
  display_name: string;
  avatar: string | null;
  metadata?: { team_name?: string };
  is_owner?: boolean;
};

export type SleeperRoster = {
  roster_id: number;
  owner_id: string | null;
  players: string[] | null;
  starters?: string[] | null;
  reserve?: string[] | null;
  taxi?: string[] | null;
};

export type SleeperPlayer = {
  player_id: string;
  full_name?: string;
  first_name?: string;
  last_name?: string;
  position?: string;
  team?: string;
  status?: string;
  active?: boolean;
  age?: number;
  years_exp?: number;
  birth_date?: string;
};

export type SleeperTradedPick = {
  season: string;
  round: number;
  roster_id: number;
  previous_owner_id: number;
  owner_id: number;
};

async function sleeperGet<T>(path: string): Promise<T> {
  const res = await fetch(`${BASE}${path}`, {
    next: { revalidate: 0 },
    headers: { Accept: "application/json" },
  });
  if (!res.ok) {
    throw new Error(`Sleeper API ${path} failed: ${res.status}`);
  }
  return res.json() as Promise<T>;
}

export async function fetchLeague(leagueId: string) {
  return sleeperGet<SleeperLeague>(`/league/${leagueId}`);
}

export async function fetchLeagueUsers(leagueId: string) {
  return sleeperGet<SleeperUser[]>(`/league/${leagueId}/users`);
}

export async function fetchLeagueRosters(leagueId: string) {
  return sleeperGet<SleeperRoster[]>(`/league/${leagueId}/rosters`);
}

export async function fetchTradedPicks(leagueId: string) {
  return sleeperGet<SleeperTradedPick[]>(`/league/${leagueId}/traded_picks`);
}

export async function fetchAllPlayers() {
  return sleeperGet<Record<string, SleeperPlayer>>(`/players/nfl`);
}

export type SleeperUserLookup = {
  user_id: string;
  username: string;
  display_name: string;
  avatar: string | null;
};

export async function fetchUserByUsername(username: string) {
  return sleeperGet<SleeperUserLookup | null>(
    `/user/${encodeURIComponent(username.trim())}`,
  );
}

export async function fetchUserLeagues(userId: string, season: string) {
  return sleeperGet<SleeperLeague[]>(`/user/${userId}/leagues/nfl/${season}`);
}

export async function fetchNflState() {
  return sleeperGet<{
    season: string;
    league_season?: string;
    previous_season?: string;
    season_type?: string;
    week?: number;
    display_week?: number;
    leg?: number;
  }>(`/state/nfl`);
}

export function detectScoringType(league: SleeperLeague): "1QB" | "SF" {
  const positions = league.roster_positions ?? [];
  return positions.includes("SUPER_FLEX") ? "SF" : "1QB";
}

export function normalizeName(name: string): string {
  return name
    .toLowerCase()
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/[^a-z0-9\s]/g, "")
    .replace(/\s+/g, " ")
    .trim();
}

export function playerFullName(p: SleeperPlayer): string {
  if (p.full_name) return p.full_name;
  return [p.first_name, p.last_name].filter(Boolean).join(" ") || p.player_id;
}

/** @deprecated use pickRoundToStars from stars.ts — kept for call-site compatibility */
export function defaultPickValue(round: number): number {
  const table: Record<number, number> = {
    1: 3.5,
    2: 2.5,
    3: 1.5,
    4: 1.0,
    5: 0.5,
  };
  return table[round] ?? 0.5;
}
