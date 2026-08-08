import { prisma } from "./prisma";
import {
  getLeaguePickConsensus,
  getLeaguePlayerConsensus,
} from "./league-consensus";

export type ValueRowPayload = {
  kind: "player" | "pick";
  id: string;
  sleeperPlayerId?: string;
  /** Original team owner's Sleeper avatar (draft picks). */
  sleeperAvatarId?: string | null;
  label: string;
  position?: string | null;
  nflTeam?: string | null;
  value: number;
  /** System market baseline (ADP/proj/adjusters). */
  market: number | null;
  /** Live median of claimed managers' personal boards. */
  league: number | null;
  leagueRaters: number;
  tier: string | null;
  onRoster: boolean;
};

export async function buildValuesPayload(leagueId: string, teamId: string) {
  const team = await prisma.team.findFirst({ where: { id: teamId, leagueId } });
  if (!team) throw new Error("Team not found");

  const rosterIds = JSON.parse(team.playerIds || "[]") as string[];
  const players = await prisma.player.findMany({
    where: { sleeperPlayerId: { in: rosterIds } },
  });

  const allTeams = await prisma.team.findMany({ where: { leagueId } });
  const leaguePlayerSleeperIds = new Set<string>();
  for (const t of allTeams) {
    for (const id of JSON.parse(t.playerIds || "[]") as string[]) {
      leaguePlayerSleeperIds.add(id);
    }
  }
  const leaguePlayers = await prisma.player.findMany({
    where: {
      sleeperPlayerId: { in: [...leaguePlayerSleeperIds] },
      id: { notIn: players.map((p) => p.id) },
    },
  });

  const allPlayerIds = [...players, ...leaguePlayers].map((p) => p.id);
  const [baselines, personal, leagueConsensus] = await Promise.all([
    prisma.baselineValue.findMany({
      where: { leagueId, playerId: { in: allPlayerIds } },
    }),
    prisma.personalValue.findMany({
      where: { teamId, playerId: { in: allPlayerIds } },
    }),
    getLeaguePlayerConsensus(leagueId, allPlayerIds),
  ]);

  const marketByPlayer = new Map(baselines.map((b) => [b.playerId, b.value]));
  const personalByPlayer = new Map(personal.map((p) => [p.playerId, p]));

  const toPlayerRow = (
    p: (typeof players)[number],
    onRoster: boolean,
  ): ValueRowPayload => {
    const pers = personalByPlayer.get(p.id);
    const market = marketByPlayer.get(p.id) ?? null;
    const consensus = leagueConsensus.get(p.id);
    return {
      kind: "player",
      id: p.id,
      sleeperPlayerId: p.sleeperPlayerId,
      label: p.fullName,
      position: p.position,
      nflTeam: p.nflTeam,
      value: pers?.value ?? market ?? 0,
      market,
      league: consensus?.value ?? null,
      leagueRaters: consensus?.raters ?? 0,
      tier: pers?.tier ?? "fair",
      onRoster,
    };
  };

  const roster = players
    .map((p) => toPlayerRow(p, true))
    .sort((a, b) => b.value - a.value);

  const picks = await prisma.draftPick.findMany({
    where: { leagueId, rosterId: team.sleeperRosterId },
    orderBy: [{ season: "asc" }, { round: "asc" }],
  });
  const teamByRosterId = new Map(
    allTeams.map((t) => [t.sleeperRosterId, t] as const),
  );
  const [pickBaselines, pickPersonal, pickConsensus] = await Promise.all([
    prisma.baselinePickValue.findMany({
      where: { leagueId, pickId: { in: picks.map((p) => p.id) } },
    }),
    prisma.personalPickValue.findMany({
      where: { teamId, pickId: { in: picks.map((p) => p.id) } },
    }),
    getLeaguePickConsensus(
      leagueId,
      picks.map((p) => p.id),
    ),
  ]);
  const pb = new Map(pickBaselines.map((b) => [b.pickId, b.value]));
  const pp = new Map(pickPersonal.map((p) => [p.pickId, p]));

  const pickRows: ValueRowPayload[] = picks.map((p) => {
    const pers = pp.get(p.id);
    const market = pb.get(p.id) ?? null;
    const consensus = pickConsensus.get(p.id);
    const original = teamByRosterId.get(p.originalRosterId);
    return {
      kind: "pick",
      id: p.id,
      sleeperAvatarId: original?.avatar ?? null,
      label: p.label,
      position: "PICK",
      nflTeam: null,
      value: pers?.value ?? market ?? 0,
      market,
      league: consensus?.value ?? null,
      leagueRaters: consensus?.raters ?? 0,
      tier: pers?.tier ?? "fair",
      onRoster: true,
    };
  });

  const leagueAssets = leaguePlayers
    .map((p) => toPlayerRow(p, false))
    .sort((a, b) => b.value - a.value);

  const claimedCount = allTeams.filter((t) => t.claimToken).length;

  return {
    team,
    roster: [...roster, ...pickRows],
    leagueAssets,
    claimedManagers: claimedCount,
  };
}
