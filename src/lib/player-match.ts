import { normalizeName } from "./sleeper";

export type MatchCandidate = {
  id: string;
  sleeperPlayerId: string;
  fullName: string;
  searchName: string;
  position?: string | null;
};

export type CsvRow = {
  name: string;
  value: number;
  position?: string;
  sleeperId?: string;
};

export type MatchResult = {
  row: CsvRow;
  playerId: string | null;
  sleeperPlayerId: string | null;
  confidence: "exact_id" | "exact_name" | "fuzzy_name" | "unmatched";
  matchedName?: string;
};

function levenshtein(a: string, b: string): number {
  const m = a.length;
  const n = b.length;
  const dp = Array.from({ length: m + 1 }, () => new Array<number>(n + 1).fill(0));
  for (let i = 0; i <= m; i++) dp[i][0] = i;
  for (let j = 0; j <= n; j++) dp[0][j] = j;
  for (let i = 1; i <= m; i++) {
    for (let j = 1; j <= n; j++) {
      const cost = a[i - 1] === b[j - 1] ? 0 : 1;
      dp[i][j] = Math.min(dp[i - 1][j] + 1, dp[i][j - 1] + 1, dp[i - 1][j - 1] + cost);
    }
  }
  return dp[m][n];
}

export function matchCsvRows(
  rows: CsvRow[],
  players: MatchCandidate[],
): MatchResult[] {
  const byId = new Map(players.map((p) => [p.sleeperPlayerId, p]));
  const byName = new Map<string, MatchCandidate[]>();
  for (const p of players) {
    const list = byName.get(p.searchName) ?? [];
    list.push(p);
    byName.set(p.searchName, list);
  }

  return rows.map((row) => {
    if (row.sleeperId && byId.has(row.sleeperId)) {
      const p = byId.get(row.sleeperId)!;
      return {
        row,
        playerId: p.id,
        sleeperPlayerId: p.sleeperPlayerId,
        confidence: "exact_id" as const,
        matchedName: p.fullName,
      };
    }

    const norm = normalizeName(row.name);
    const exact = byName.get(norm);
    if (exact?.length === 1) {
      return {
        row,
        playerId: exact[0].id,
        sleeperPlayerId: exact[0].sleeperPlayerId,
        confidence: "exact_name" as const,
        matchedName: exact[0].fullName,
      };
    }
    if (exact && exact.length > 1 && row.position) {
      const posMatch = exact.filter(
        (p) => p.position?.toUpperCase() === row.position!.toUpperCase(),
      );
      if (posMatch.length === 1) {
        return {
          row,
          playerId: posMatch[0].id,
          sleeperPlayerId: posMatch[0].sleeperPlayerId,
          confidence: "exact_name" as const,
          matchedName: posMatch[0].fullName,
        };
      }
    }

    let best: MatchCandidate | null = null;
    let bestDist = Infinity;
    for (const p of players) {
      if (row.position && p.position && p.position.toUpperCase() !== row.position.toUpperCase()) {
        continue;
      }
      const dist = levenshtein(norm, p.searchName);
      const threshold = Math.max(2, Math.floor(norm.length * 0.2));
      if (dist < bestDist && dist <= threshold) {
        bestDist = dist;
        best = p;
      }
    }

    if (best) {
      return {
        row,
        playerId: best.id,
        sleeperPlayerId: best.sleeperPlayerId,
        confidence: "fuzzy_name" as const,
        matchedName: best.fullName,
      };
    }

    return {
      row,
      playerId: null,
      sleeperPlayerId: null,
      confidence: "unmatched" as const,
    };
  });
}
