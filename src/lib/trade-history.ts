import { prisma } from "./prisma";
import {
  fetchLeague,
  fetchLeagueTransactions,
  type SleeperLeague,
  type SleeperTransaction,
} from "./sleeper";
import { packageTradeValue, pickRoundToStars } from "./stars";

export type HistoryAsset = {
  kind: "player" | "pick";
  label: string;
  sleeperPlayerId?: string;
  position?: string | null;
  /** Market ★ at today's baseline (neutral benchmark, not anyone's board). */
  stars: number;
};

export type HistorySide = {
  rosterId: number;
  teamLabel: string;
  receives: HistoryAsset[];
  tv: number;
};

export type HistoryTrade = {
  id: string;
  created: number;
  season: string;
  sides: HistorySide[];
};

const TTL_MS = 15 * 60 * 1000;
const cache = new Map<string, { at: number; trades: HistoryTrade[] }>();

async function completedTrades(sleeperLeagueId: string): Promise<SleeperTransaction[]> {
  const rounds = Array.from({ length: 19 }, (_, i) => i);
  const batches = await Promise.all(
    rounds.map((r) => fetchLeagueTransactions(sleeperLeagueId, r).catch(() => [])),
  );
  return batches.flat().filter((t) => t.type === "trade" && t.status === "complete");
}

/** Completed trades from this league and its previous season (dynasty chain). */
export async function getLeagueTradeHistory(
  leagueId: string,
  seasons = 2,
): Promise<HistoryTrade[]> {
  const hit = cache.get(leagueId);
  if (hit && Date.now() - hit.at < TTL_MS) return hit.trades;

  const league = await prisma.league.findUnique({ where: { id: leagueId } });
  if (!league) throw new Error("League not found");

  const chain: { id: string; season: string }[] = [];
  let currentId: string | null = league.sleeperLeagueId;
  while (currentId && chain.length < seasons) {
    const info: SleeperLeague | null = await fetchLeague(currentId).catch(() => null);
    if (!info) break;
    chain.push({ id: currentId, season: String(info.season) });
    const prev: string | null | undefined = info.previous_league_id;
    currentId = prev && prev !== "0" ? prev : null;
  }

  const raw = (
    await Promise.all(
      chain.map(async (s) =>
        (await completedTrades(s.id)).map((t) => ({ t, season: s.season })),
      ),
    )
  ).flat();

  const seen = new Set<string>();
  const unique = raw.filter(({ t }) => {
    if (seen.has(t.transaction_id)) return false;
    seen.add(t.transaction_id);
    return true;
  });

  const sleeperPlayerIds = new Set<string>();
  for (const { t } of unique) {
    for (const pid of Object.keys(t.adds ?? {})) sleeperPlayerIds.add(pid);
  }

  const [players, teams, picks] = await Promise.all([
    prisma.player.findMany({
      where: { sleeperPlayerId: { in: [...sleeperPlayerIds] } },
      select: { id: true, sleeperPlayerId: true, fullName: true, position: true },
    }),
    prisma.team.findMany({ where: { leagueId } }),
    prisma.draftPick.findMany({ where: { leagueId } }),
  ]);
  const [playerBaselines, pickBaselines] = await Promise.all([
    prisma.baselineValue.findMany({
      where: { leagueId, playerId: { in: players.map((p) => p.id) } },
    }),
    prisma.baselinePickValue.findMany({ where: { leagueId } }),
  ]);

  const playerBySleeper = new Map(players.map((p) => [p.sleeperPlayerId, p]));
  const playerStars = new Map(playerBaselines.map((b) => [b.playerId, b.value]));
  const pickStars = new Map(pickBaselines.map((b) => [b.pickId, b.value]));
  const teamByRoster = new Map(teams.map((t) => [t.sleeperRosterId, t]));
  const pickByKey = new Map(
    picks.map((p) => [`${p.season}-${p.round}-${p.originalRosterId}`, p]),
  );
  const teamLabel = (rosterId: number) => {
    const t = teamByRoster.get(rosterId);
    return t ? t.claimedLabel || t.teamName || t.displayName : `Roster ${rosterId}`;
  };

  const trades: HistoryTrade[] = unique.map(({ t, season }) => {
    const sides: HistorySide[] = t.roster_ids.map((rosterId) => {
      const receives: HistoryAsset[] = [];
      for (const [pid, toRoster] of Object.entries(t.adds ?? {})) {
        if (toRoster !== rosterId) continue;
        const p = playerBySleeper.get(pid);
        receives.push({
          kind: "player",
          label: p?.fullName ?? `Player ${pid}`,
          sleeperPlayerId: pid,
          position: p?.position ?? null,
          stars: p ? (playerStars.get(p.id) ?? 0) : 0,
        });
      }
      for (const dp of t.draft_picks ?? []) {
        if (dp.owner_id !== rosterId) continue;
        const known = pickByKey.get(`${dp.season}-${dp.round}-${dp.roster_id}`);
        receives.push({
          kind: "pick",
          label: `${dp.season} Round ${dp.round} (${teamLabel(dp.roster_id)})`,
          position: "PICK",
          stars: known ? (pickStars.get(known.id) ?? pickRoundToStars(dp.round)) : pickRoundToStars(dp.round),
        });
      }
      return {
        rosterId,
        teamLabel: teamLabel(rosterId),
        receives,
        tv: packageTradeValue(receives.map((a) => a.stars)),
      };
    });
    return { id: t.transaction_id, created: t.created, season, sides };
  });

  trades.sort((a, b) => b.created - a.created);
  cache.set(leagueId, { at: Date.now(), trades });
  return trades;
}
