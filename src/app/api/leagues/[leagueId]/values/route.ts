import { NextResponse } from "next/server";
import { z } from "zod";
import { requireClaimedTeam } from "@/lib/access";
import { prisma } from "@/lib/prisma";
import { buildValuesPayload } from "@/lib/values-payload";

type Params = { params: Promise<{ leagueId: string }> };

const starValue = z
  .number()
  .finite()
  .min(0)
  .max(5)
  .refine((n) => Math.abs(n * 2 - Math.round(n * 2)) < 1e-9, {
    message: "Stars must be in 0.5 steps",
  });

const updateSchema = z.object({
  updates: z.array(
    z.object({
      kind: z.enum(["player", "pick"]),
      id: z.string(),
      value: starValue,
      tier: z.enum(["love", "fair", "fade"]).optional().nullable(),
    }),
  ),
});

export async function GET(_req: Request, { params }: Params) {
  const { leagueId } = await params;
  const access = await requireClaimedTeam(leagueId);
  if (access.error || !access.team) {
    return NextResponse.json({ error: access.error || "Claim a team first" }, { status: 400 });
  }

  const payload = await buildValuesPayload(leagueId, access.team.id);
  return NextResponse.json(payload);
}

export async function PUT(req: Request, { params }: Params) {
  const { leagueId } = await params;
  const access = await requireClaimedTeam(leagueId);
  if (access.error || !access.team) {
    return NextResponse.json({ error: access.error || "Claim a team first" }, { status: 400 });
  }
  const team = access.team;

  const parsed = updateSchema.safeParse(await req.json());
  if (!parsed.success) {
    return NextResponse.json({ error: "Invalid updates" }, { status: 400 });
  }

  for (const u of parsed.data.updates) {
    if (u.kind === "player") {
      await prisma.personalValue.upsert({
        where: { teamId_playerId: { teamId: team.id, playerId: u.id } },
        create: {
          leagueId,
          teamId: team.id,
          playerId: u.id,
          value: u.value,
          tier: u.tier ?? "fair",
        },
        update: {
          value: u.value,
          tier: u.tier ?? undefined,
        },
      });
    } else {
      await prisma.personalPickValue.upsert({
        where: { teamId_pickId: { teamId: team.id, pickId: u.id } },
        create: {
          leagueId,
          teamId: team.id,
          pickId: u.id,
          value: u.value,
          tier: u.tier ?? "fair",
        },
        update: {
          value: u.value,
          tier: u.tier ?? undefined,
        },
      });
    }
  }

  // Return fresh rows so league consensus reflects this save immediately
  const payload = await buildValuesPayload(leagueId, team.id);
  return NextResponse.json({
    ok: true,
    count: parsed.data.updates.length,
    ...payload,
  });
}
