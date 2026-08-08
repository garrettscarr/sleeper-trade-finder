import { NextResponse } from "next/server";
import { z } from "zod";
import { requireLeagueAccess } from "@/lib/access";
import { prisma } from "@/lib/prisma";
import { randomCode, upsertMembership } from "@/lib/session";
import { seedPersonalValuesForTeam } from "@/lib/sync-league";

type Params = { params: Promise<{ leagueId: string }> };

const schema = z.object({
  teamId: z.string().min(1),
  label: z.string().max(40).optional(),
});

export async function POST(req: Request, { params }: Params) {
  const { leagueId } = await params;
  const access = await requireLeagueAccess(leagueId);
  if (access.error) {
    return NextResponse.json({ error: access.error }, { status: 403 });
  }

  const parsed = schema.safeParse(await req.json());
  if (!parsed.success) {
    return NextResponse.json({ error: "Invalid request" }, { status: 400 });
  }

  const team = await prisma.team.findFirst({
    where: { id: parsed.data.teamId, leagueId },
  });
  if (!team) {
    return NextResponse.json({ error: "Team not found" }, { status: 404 });
  }

  const membership = access.membership!;
  const ownsThis =
    membership.teamId === team.id &&
    membership.claimToken &&
    team.claimToken === membership.claimToken;

  if (team.claimToken && !ownsThis) {
    return NextResponse.json({ error: "Team already claimed" }, { status: 409 });
  }

  // Release previous claim from this browser in this league
  if (membership.teamId && membership.claimToken && membership.teamId !== team.id) {
    await prisma.team.updateMany({
      where: {
        id: membership.teamId,
        leagueId,
        claimToken: membership.claimToken,
      },
      data: { claimToken: null, claimedLabel: null },
    });
  }

  const claimToken = team.claimToken && ownsThis ? team.claimToken : randomCode(12);
  const updated = await prisma.team.update({
    where: { id: team.id },
    data: {
      claimToken,
      claimedLabel: parsed.data.label?.trim() || team.displayName,
    },
  });

  await upsertMembership({
    leagueId,
    role: membership.role,
    teamId: updated.id,
    claimToken,
  });

  await seedPersonalValuesForTeam(leagueId, team.id);

  return NextResponse.json({ team: updated });
}
