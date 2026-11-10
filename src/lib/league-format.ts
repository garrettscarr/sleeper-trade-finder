export type LeagueFormatFields = { format: string; picksTradeable: boolean | null };

/** Draft picks only trade in dynasty leagues unless the commissioner overrides it. */
export function picksAllowed(league: LeagueFormatFields): boolean {
  return league.picksTradeable ?? league.format === "dynasty";
}

export function formatLabel(format: string): string {
  if (format === "redraft") return "Redraft";
  if (format === "keeper") return "Keeper";
  return "Dynasty";
}
