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
  /** Fantasy team that currently holds this asset. */
  ownerTeamId?: string | null;
  ownerTeamLabel?: string | null;
  ownerAvatar?: string | null;
};

function teamLabel(t: {
  teamName: string | null;
  displayName: string;
  claimedLabel: string | null;
}) {
  return t.claimedLabel || t.teamName || t.displayName;
}

export async function buildValuesPayload(leagueId: string, teamId: string) {
  const team = await prisma.team.findFirst({ where: { id: teamId, leagueId } });
  if (!team) throw new Error("Team not found");

  const rosterIds = JSON.parse(team.playerIds || "[]") as string[];
  const players = await prisma.player.findMany({
    where: { sleeperPlayerId: { in: rosterIds } },
  });

  const allTeams = await prisma.team.findMany({
    where: { leagueId },
    orderBy: { displayName: "asc" },
  });

  const ownerBySleeperPlayer = new Map<string, (typeof allTeams)[number]>();
  for (const t of allTeams) {
    for (const id of JSON.parse(t.playerIds || "[]") as string[]) {
      ownerBySleeperPlayer.set(id, t);
    }
  }

  const leaguePlayerSleeperIds = [...ownerBySleeperPlayer.keys()];
  const leaguePlayers = await prisma.player.findMany({
    where: {
      sleeperPlayerId: { in: leaguePlayerSleeperIds },
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
    const owner = ownerBySleeperPlayer.get(p.sleeperPlayerId);
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
      ownerTeamId: owner?.id ?? null,
      ownerTeamLabel: owner ? teamLabel(owner) : null,
      ownerAvatar: owner?.avatar ?? null,
    };
  };

  const posOrder = (pos: string | null | undefined) => {
    const order = ["QB", "RB", "WR", "TE", "K", "DEF", "PICK"];
    const i = order.indexOf(pos || "");
    return i === -1 ? 99 : i;
  };

  const roster = players
    .map((p) => toPlayerRow(p, true))
    .sort((a, b) => posOrder(a.position) - posOrder(b.position) || b.value - a.value);

  const allPicks = await prisma.draftPick.findMany({
    where: { leagueId },
    orderBy: [{ season: "asc" }, { round: "asc" }],
  });
  const teamByRosterId = new Map(
    allTeams.map((t) => [t.sleeperRosterId, t] as const),
  );
  const pickIds = allPicks.map((p) => p.id);
  const [pickBaselines, pickPersonal, pickConsensus] = await Promise.all([
    prisma.baselinePickValue.findMany({
      where: { leagueId, pickId: { in: pickIds } },
    }),
    prisma.personalPickValue.findMany({
      where: { teamId, pickId: { in: pickIds } },
    }),
    getLeaguePickConsensus(leagueId, pickIds),
  ]);
  const pb = new Map(pickBaselines.map((b) => [b.pickId, b.value]));
  const pp = new Map(pickPersonal.map((p) => [p.pickId, p]));

  const toPickRow = (
    p: (typeof allPicks)[number],
    onRoster: boolean,
  ): ValueRowPayload => {
    const pers = pp.get(p.id);
    const market = pb.get(p.id) ?? null;
    const consensus = pickConsensus.get(p.id);
    const holder = teamByRosterId.get(p.rosterId);
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
      onRoster,
      ownerTeamId: holder?.id ?? null,
      ownerTeamLabel: holder ? teamLabel(holder) : null,
      ownerAvatar: holder?.avatar ?? null,
    };
  };

  const myPickRows = allPicks
    .filter((p) => p.rosterId === team.sleeperRosterId)
    .map((p) => toPickRow(p, true));

  const otherPickRows = allPicks
    .filter((p) => p.rosterId !== team.sleeperRosterId)
    .map((p) => toPickRow(p, false));

  const leagueAssets = [
    ...leaguePlayers.map((p) => toPlayerRow(p, false)),
    ...otherPickRows,
  ].sort((a, b) => {
    const teamCmp = (a.ownerTeamLabel || "").localeCompare(b.ownerTeamLabel || "");
    if (teamCmp !== 0) return teamCmp;
    if (a.kind !== b.kind) return a.kind === "pick" ? 1 : -1;
    return posOrder(a.position) - posOrder(b.position) || b.value - a.value;
  });

  const claimedCount = allTeams.filter((t) => t.claimToken).length;
  const teamFilters = allTeams
    .filter((t) => t.id !== team.id)
    .map((t) => ({
      id: t.id,
      label: teamLabel(t),
      avatar: t.avatar,
    }));

  return {
    team,
    roster: [...roster, ...myPickRows],
    leagueAssets,
    teamFilters,
    claimedManagers: claimedCount,
  };
}
