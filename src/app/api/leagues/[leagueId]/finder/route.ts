import { NextResponse } from "next/server";
import { z } from "zod";
import { requireClaimedTeam, requireLeagueAccess } from "@/lib/access";
import { prisma } from "@/lib/prisma";
import {
  findTradePackages,
  resolveValue,
  type AssetRef,
  type ValueMaps,
} from "@/lib/trade-finder";

type Params = { params: Promise<{ leagueId: string }> };

const schema = z.object({
  partnerTeamId: z.string(),
  wantPlayerIds: z.array(z.string()).default([]),
  wantPickIds: z.array(z.string()).default([]),
  fairnessBand: z.number().min(0.01).max(0.5).default(0.1),
  maxGiveAssets: z.number().int().min(1).max(3).default(2),
});

async function buildValueMaps(
  leagueId: string,
  yourTeamId: string,
  partnerTeamId: string,
  assetKeys: { kind: "player" | "pick"; id: string }[],
): Promise<ValueMaps> {
  const playerIds = assetKeys.filter((a) => a.kind === "player").map((a) => a.id);
  const pickIds = assetKeys.filter((a) => a.kind === "pick").map((a) => a.id);

  const [yourPlayers, partnerPlayers, basePlayers, yourPicks, partnerPicks, basePicks] =
    await Promise.all([
      prisma.personalValue.findMany({
        where: { teamId: yourTeamId, playerId: { in: playerIds } },
      }),
      prisma.personalValue.findMany({
        where: { teamId: partnerTeamId, playerId: { in: playerIds } },
      }),
      prisma.baselineValue.findMany({
        where: { leagueId, playerId: { in: playerIds } },
      }),
      prisma.personalPickValue.findMany({
        where: { teamId: yourTeamId, pickId: { in: pickIds } },
      }),
      prisma.personalPickValue.findMany({
        where: { teamId: partnerTeamId, pickId: { in: pickIds } },
      }),
      prisma.baselinePickValue.findMany({
        where: { leagueId, pickId: { in: pickIds } },
      }),
    ]);

  const yp = new Map(yourPlayers.map((v) => [v.playerId, v.value]));
  const pp = new Map(partnerPlayers.map((v) => [v.playerId, v.value]));
  const bp = new Map(basePlayers.map((v) => [v.playerId, v.value]));
  const ypk = new Map(yourPicks.map((v) => [v.pickId, v.value]));
  const ppk = new Map(partnerPicks.map((v) => [v.pickId, v.value]));
  const bpk = new Map(basePicks.map((v) => [v.pickId, v.value]));

  const partner = new Map<string, number>();
  const you = new Map<string, number>();
  const community = new Map<string, number>();

  for (const id of playerIds) {
    const key = `player:${id}`;
    community.set(key, bp.get(id) ?? 0);
    you.set(key, resolveValue(yp.get(id), bp.get(id)));
    partner.set(key, resolveValue(pp.get(id), bp.get(id)));
  }
  for (const id of pickIds) {
    const key = `pick:${id}`;
    community.set(key, bpk.get(id) ?? 0);
    you.set(key, resolveValue(ypk.get(id), bpk.get(id)));
    partner.set(key, resolveValue(ppk.get(id), bpk.get(id)));
  }

  return { partner, you, community };
}

export async function POST(req: Request, { params }: Params) {
  const { leagueId } = await params;
  const access = await requireClaimedTeam(leagueId);
  if (access.error || !access.team) {
    return NextResponse.json({ error: access.error || "Claim a team first" }, { status: 400 });
  }
  const yourTeam = access.team;

  const parsed = schema.safeParse(await req.json());
  if (!parsed.success) {
    return NextResponse.json({ error: "Invalid request" }, { status: 400 });
  }

  const partnerTeam = await prisma.team.findFirst({
    where: { id: parsed.data.partnerTeamId, leagueId },
  });
  if (!partnerTeam) {
    return NextResponse.json({ error: "Partner team not found" }, { status: 404 });
  }
  if (partnerTeam.id === yourTeam.id) {
    return NextResponse.json({ error: "Pick a different partner" }, { status: 400 });
  }

  const yourRosterIds = JSON.parse(yourTeam.playerIds || "[]") as string[];
  const partnerRosterIds = JSON.parse(partnerTeam.playerIds || "[]") as string[];

  const [yourPlayers, partnerPlayers, yourPicks, partnerPicks, leagueTeams] =
    await Promise.all([
      prisma.player.findMany({ where: { sleeperPlayerId: { in: yourRosterIds } } }),
      prisma.player.findMany({ where: { sleeperPlayerId: { in: partnerRosterIds } } }),
      prisma.draftPick.findMany({
        where: { leagueId, rosterId: yourTeam.sleeperRosterId },
      }),
      prisma.draftPick.findMany({
        where: { leagueId, rosterId: partnerTeam.sleeperRosterId },
      }),
      prisma.team.findMany({
        where: { leagueId },
        select: { sleeperRosterId: true, avatar: true },
      }),
    ]);

  const avatarByRoster = new Map(
    leagueTeams.map((t) => [t.sleeperRosterId, t.avatar] as const),
  );

  const wantPlayers = partnerPlayers.filter((p) =>
    parsed.data.wantPlayerIds.includes(p.id),
  );
  const wantPicks = partnerPicks.filter((p) => parsed.data.wantPickIds.includes(p.id));

  if (wantPlayers.length === 0 && wantPicks.length === 0) {
    return NextResponse.json({ error: "Select at least one asset you want" }, { status: 400 });
  }

  const yourAssets: AssetRef[] = [
    ...yourPlayers.map((p) => ({
      kind: "player" as const,
      id: p.id,
      sleeperId: p.sleeperPlayerId,
      label: p.fullName,
      position: p.position,
    })),
    ...yourPicks.map((p) => ({
      kind: "pick" as const,
      id: p.id,
      sleeperAvatarId: avatarByRoster.get(p.originalRosterId) ?? null,
      label: p.label,
      position: "PICK",
    })),
  ];

  const wantAssets: AssetRef[] = [
    ...wantPlayers.map((p) => ({
      kind: "player" as const,
      id: p.id,
      sleeperId: p.sleeperPlayerId,
      label: p.fullName,
      position: p.position,
    })),
    ...wantPicks.map((p) => ({
      kind: "pick" as const,
      id: p.id,
      sleeperAvatarId: avatarByRoster.get(p.originalRosterId) ?? null,
      label: p.label,
      position: "PICK",
    })),
  ];

  const allKeys = [...yourAssets, ...wantAssets].map((a) => ({
    kind: a.kind,
    id: a.id,
  }));
  const values = await buildValueMaps(leagueId, yourTeam.id, partnerTeam.id, allKeys);

  const missingPartner = wantAssets.filter(
    (a) => (values.partner.get(`${a.kind}:${a.id}`) ?? 0) === 0,
  );

  const proposals = findTradePackages({
    yourAssets,
    wantAssets,
    values,
    fairnessBand: parsed.data.fairnessBand,
    maxGiveAssets: parsed.data.maxGiveAssets,
  });

  return NextResponse.json({
    proposals,
    warnings: missingPartner.length
      ? [
          `Partner has no value (and no baseline) for: ${missingPartner.map((a) => a.label).join(", ")}`,
        ]
      : [],
    partnerTeam: {
      id: partnerTeam.id,
      displayName: partnerTeam.displayName,
      teamName: partnerTeam.teamName,
      hasClaim: Boolean(partnerTeam.claimToken),
    },
  });
}

export async function GET(_req: Request, { params }: Params) {
  const { leagueId } = await params;
  const access = await requireClaimedTeam(leagueId);
  if (access.error || !access.team) {
    return NextResponse.json({ error: access.error || "Claim a team first" }, { status: 400 });
  }

  // Ensure league access exists (claimed team implies it)
  await requireLeagueAccess(leagueId);

  const yourTeam = access.team;
  const teams = await prisma.team.findMany({
    where: { leagueId, id: { not: yourTeam.id } },
    orderBy: { displayName: "asc" },
  });

  const allLeagueTeams = await prisma.team.findMany({
    where: { leagueId },
    select: { sleeperRosterId: true, avatar: true },
  });
  const avatarByRoster = new Map(
    allLeagueTeams.map((t) => [t.sleeperRosterId, t.avatar] as const),
  );

  const partnerOptions = await Promise.all(
    teams.map(async (t) => {
      const playerIds = JSON.parse(t.playerIds || "[]") as string[];
      const players = await prisma.player.findMany({
        where: { sleeperPlayerId: { in: playerIds } },
        orderBy: { fullName: "asc" },
      });
      const picks = await prisma.draftPick.findMany({
        where: { leagueId, rosterId: t.sleeperRosterId },
        orderBy: [{ season: "asc" }, { round: "asc" }],
      });
      return {
        team: {
          id: t.id,
          displayName: t.displayName,
          teamName: t.teamName,
          claimed: Boolean(t.claimToken),
        },
        players: players.map((p) => ({
          id: p.id,
          sleeperPlayerId: p.sleeperPlayerId,
          label: p.fullName,
          position: p.position,
        })),
        picks: picks.map((p) => ({
          id: p.id,
          label: p.label,
          sleeperAvatarId: avatarByRoster.get(p.originalRosterId) ?? null,
        })),
      };
    }),
  );

  return NextResponse.json({ yourTeam, partners: partnerOptions });
}
