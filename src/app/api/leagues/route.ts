import { NextResponse } from "next/server";
import { z } from "zod";
import { sessionLeagueIds } from "@/lib/access";
import { prisma } from "@/lib/prisma";
import { getSession, upsertMembership } from "@/lib/session";
import { recomputeStarBaselines } from "@/lib/baseline";
import { syncLeagueFromSleeper } from "@/lib/sync-league";

const createSchema = z.object({
  sleeperLeagueId: z.string().min(3),
});

export async function GET() {
  const session = await getSession();
  const ids = sessionLeagueIds(session);
  if (ids.length === 0) {
    return NextResponse.json({ leagues: [] });
  }

  const leagues = await prisma.league.findMany({
    where: { id: { in: ids } },
    include: {
      teams: {
        select: {
          id: true,
          displayName: true,
          claimToken: true,
        },
      },
      _count: { select: { baselineValues: true } },
    },
    orderBy: { createdAt: "desc" },
  });

  return NextResponse.json({
    leagues,
    memberships: session.memberships,
  });
}

export async function POST(req: Request) {
  const parsed = createSchema.safeParse(await req.json());
  if (!parsed.success) {
    return NextResponse.json({ error: "Invalid league ID" }, { status: 400 });
  }

  const sleeperLeagueId = parsed.data.sleeperLeagueId.trim();
  const existing = await prisma.league.findUnique({
    where: { sleeperLeagueId },
  });

  if (existing) {
    // Already imported — unlock with admin code separately; don't auto-grant admin
    return NextResponse.json({
      league: {
        id: existing.id,
        name: existing.name,
        sleeperLeagueId: existing.sleeperLeagueId,
      },
      alreadyExists: true,
      message:
        "This league is already set up. Use the invite code to claim a team, or the admin code for commissioner tools.",
    });
  }

  try {
    const league = await syncLeagueFromSleeper({ sleeperLeagueId });
    await upsertMembership({
      leagueId: league.id,
      role: "admin",
    });
    let baseline = null;
    try {
      baseline = await recomputeStarBaselines(league.id);
    } catch {
      // League still usable; admin can retry baseline compute
    }
    return NextResponse.json({
      league: {
        id: league.id,
        name: league.name,
        sleeperLeagueId: league.sleeperLeagueId,
        inviteCode: league.inviteCode,
        adminCode: league.adminCode,
        scoringType: league.scoringType,
      },
      baseline,
      alreadyExists: false,
    });
  } catch (e) {
    const message = e instanceof Error ? e.message : "Failed to import league";
    return NextResponse.json({ error: message }, { status: 502 });
  }
}
