import { NextResponse } from "next/server";
import { z } from "zod";
import { requireClaimedTeam } from "@/lib/access";
import {
  generateMockOffers,
  offerTargets,
  type LabAsset,
  type LabTeam,
} from "@/lib/mock-offers";
import { prisma } from "@/lib/prisma";
import { packageTradeValue, starsForPackageValue, STAR_ELITE, STAR_MAX } from "@/lib/stars";
import { buildValuesPayload, type ValueRowPayload } from "@/lib/values-payload";

type Params = { params: Promise<{ leagueId: string }> };

const subjectSchema = z.object({
  kind: z.enum(["player", "pick"]),
  id: z.string().min(1),
});

const offersSchema = subjectSchema.extend({
  low: z.number().positive().nullable().optional(),
  high: z.number().positive().nullable().optional(),
});

const acceptSchema = subjectSchema.extend({
  tv: z.number().positive(),
});

function toLabAsset(r: ValueRowPayload): LabAsset {
  return {
    kind: r.kind,
    id: r.id,
    label: r.label,
    stars: r.value,
    sleeperPlayerId: r.sleeperPlayerId,
    sleeperAvatarId: r.sleeperAvatarId,
    position: r.position,
  };
}

/** Mock offers for one of your assets, priced on your own board. */
export async function POST(req: Request, { params }: Params) {
  const { leagueId } = await params;
  const access = await requireClaimedTeam(leagueId);
  if (access.error || !access.team) {
    return NextResponse.json({ error: access.error || "Claim a team first" }, { status: 400 });
  }

  const parsed = offersSchema.safeParse(await req.json());
  if (!parsed.success) {
    return NextResponse.json({ error: "Invalid request" }, { status: 400 });
  }
  const { kind, id, low, high } = parsed.data;

  const payload = await buildValuesPayload(leagueId, access.team.id);
  const subject = payload.roster.find((r) => r.kind === kind && r.id === id);
  if (!subject) {
    return NextResponse.json({ error: "That asset is not on your roster" }, { status: 404 });
  }

  const byTeam = new Map<string, LabTeam>();
  for (const row of payload.leagueAssets) {
    if (!row.ownerTeamId) continue;
    const team = byTeam.get(row.ownerTeamId) ?? {
      teamId: row.ownerTeamId,
      label: row.ownerTeamLabel || "Team",
      avatar: row.ownerAvatar ?? null,
      assets: [],
    };
    team.assets.push(toLabAsset(row));
    byTeam.set(row.ownerTeamId, team);
  }

  const referenceTv = packageTradeValue([subject.value || subject.market || 0.5]);
  const maxTv = packageTradeValue([STAR_ELITE]);
  const maxed = low != null && low >= maxTv * 0.98;
  const targets = offerTargets({ referenceTv, low, high });
  // Above 5★ a fair return usually takes four pieces.
  const haul = targets.some((t) => t > packageTradeValue([STAR_MAX]));

  const offers = maxed
    ? []
    : generateMockOffers({
        teams: [...byTeam.values()],
        targets,
        maxAssets: haul ? 4 : 3,
      }).map((o) => ({ ...o, impliedStars: starsForPackageValue(o.tv) }));

  return NextResponse.json({
    subject: { ...subject, tv: referenceTv },
    offers,
    maxed,
  });
}

/** Accepting an offer sets the asset's personal ★ to that package's value. */
export async function PUT(req: Request, { params }: Params) {
  const { leagueId } = await params;
  const access = await requireClaimedTeam(leagueId);
  if (access.error || !access.team) {
    return NextResponse.json({ error: access.error || "Claim a team first" }, { status: 400 });
  }
  const team = access.team;

  const parsed = acceptSchema.safeParse(await req.json());
  if (!parsed.success) {
    return NextResponse.json({ error: "Invalid request" }, { status: 400 });
  }
  const { kind, id, tv } = parsed.data;
  const stars = starsForPackageValue(tv);

  const rosterIds = JSON.parse(team.playerIds || "[]") as string[];
  if (kind === "player") {
    const player = await prisma.player.findUnique({ where: { id } });
    if (!player || !rosterIds.includes(player.sleeperPlayerId)) {
      return NextResponse.json({ error: "That player is not on your roster" }, { status: 404 });
    }
    const prev = await prisma.personalValue.findUnique({
      where: { teamId_playerId: { teamId: team.id, playerId: id } },
    });
    await prisma.personalValue.upsert({
      where: { teamId_playerId: { teamId: team.id, playerId: id } },
      create: { leagueId, teamId: team.id, playerId: id, value: stars, userSet: true, tier: "fair" },
      update: { value: stars, userSet: true },
    });
    return NextResponse.json({ stars, previous: prev?.value ?? null });
  }

  const pick = await prisma.draftPick.findFirst({
    where: { id, leagueId, rosterId: team.sleeperRosterId },
  });
  if (!pick) {
    return NextResponse.json({ error: "That pick is not yours" }, { status: 404 });
  }
  const prev = await prisma.personalPickValue.findUnique({
    where: { teamId_pickId: { teamId: team.id, pickId: id } },
  });
  await prisma.personalPickValue.upsert({
    where: { teamId_pickId: { teamId: team.id, pickId: id } },
    create: { leagueId, teamId: team.id, pickId: id, value: stars, userSet: true, tier: "fair" },
    update: { value: stars, userSet: true },
  });
  return NextResponse.json({ stars, previous: prev?.value ?? null });
}
