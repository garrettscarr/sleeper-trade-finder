import { NextResponse } from "next/server";
import { requireAdmin } from "@/lib/access";
import { prisma } from "@/lib/prisma";
import { recomputeStarBaselines } from "@/lib/baseline";
import { syncLeagueFromSleeper } from "@/lib/sync-league";

type Params = { params: Promise<{ leagueId: string }> };

export async function POST(_req: Request, { params }: Params) {
  const { leagueId } = await params;
  const access = await requireAdmin(leagueId);
  if (access.error) {
    return NextResponse.json({ error: access.error }, { status: 403 });
  }

  const league = await prisma.league.findUnique({ where: { id: leagueId } });
  if (!league) {
    return NextResponse.json({ error: "League not found" }, { status: 404 });
  }

  try {
    const updated = await syncLeagueFromSleeper({
      sleeperLeagueId: league.sleeperLeagueId,
      existingLeagueId: league.id,
    });
    const baseline = await recomputeStarBaselines(league.id);
    return NextResponse.json({ league: updated, baseline });
  } catch (e) {
    const message = e instanceof Error ? e.message : "Sync failed";
    return NextResponse.json({ error: message }, { status: 502 });
  }
}
