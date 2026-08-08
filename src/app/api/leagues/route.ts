import { NextResponse } from "next/server";
import { z } from "zod";
import { sessionLeagueIds } from "@/lib/access";
import { prisma } from "@/lib/prisma";
import { getSession, upsertMembershipOnResponse } from "@/lib/session";
import { recomputeStarBaselines } from "@/lib/baseline";
import {
  fetchUserByUsername,
  fetchUserLeagues,
  fetchNflState,
} from "@/lib/sleeper";
import { syncLeagueFromSleeper } from "@/lib/sync-league";

const createSchema = z.object({
  sleeperLeagueId: z.string().min(3),
  /** When set, proves the requester is in the Sleeper league (for unlock / recovery). */
  sleeperUsername: z.string().min(1).max(40).optional(),
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

async function userBelongsToSleeperLeague(
  username: string,
  sleeperLeagueId: string,
): Promise<boolean> {
  const user = await fetchUserByUsername(username);
  if (!user?.user_id) return false;
  const state = await fetchNflState();
  const season = String(state.league_season || state.season);
  const leagues = await fetchUserLeagues(user.user_id, season);
  if (leagues.some((l) => l.league_id === sleeperLeagueId)) return true;
  // Also check prior season in case NFL state rolled forward early
  const prev = String(Number(season) - 1);
  if (prev !== season && Number.isFinite(Number(prev))) {
    const older = await fetchUserLeagues(user.user_id, prev);
    return older.some((l) => l.league_id === sleeperLeagueId);
  }
  return false;
}

export async function POST(req: Request) {
  const parsed = createSchema.safeParse(await req.json());
  if (!parsed.success) {
    return NextResponse.json({ error: "Invalid league ID" }, { status: 400 });
  }

  const sleeperLeagueId = parsed.data.sleeperLeagueId.trim();
  const sleeperUsername = parsed.data.sleeperUsername?.trim();

  const existing = await prisma.league.findUnique({
    where: { sleeperLeagueId },
  });

  if (existing) {
    if (!sleeperUsername) {
      return NextResponse.json({
        league: {
          id: existing.id,
          name: existing.name,
          sleeperLeagueId: existing.sleeperLeagueId,
        },
        alreadyExists: true,
        recovered: false,
        message:
          "This league is already set up. Find it again with your Sleeper username to unlock this browser and recover codes, or paste your invite/admin code on Join.",
      });
    }

    let belongs = false;
    try {
      belongs = await userBelongsToSleeperLeague(sleeperUsername, sleeperLeagueId);
    } catch {
      return NextResponse.json(
        { error: "Could not verify Sleeper username against this league" },
        { status: 502 },
      );
    }

    if (!belongs) {
      return NextResponse.json(
        {
          error:
            "That Sleeper username is not in this league, so codes cannot be recovered from here. Use the invite or admin code on Join.",
        },
        { status: 403 },
      );
    }

    const res = NextResponse.json({
      league: {
        id: existing.id,
        name: existing.name,
        sleeperLeagueId: existing.sleeperLeagueId,
        inviteCode: existing.inviteCode,
        adminCode: existing.adminCode,
        scoringType: existing.scoringType,
      },
      alreadyExists: true,
      recovered: true,
      message:
        "Welcome back — this browser is unlocked as commissioner. Save your invite and admin codes again.",
    });
    await upsertMembershipOnResponse(res, { leagueId: existing.id, role: "admin" });
    return res;
  }

  try {
    const league = await syncLeagueFromSleeper({ sleeperLeagueId });
    let baseline = null;
    try {
      baseline = await recomputeStarBaselines(league.id);
    } catch {
      // League still usable; admin can retry baseline compute
    }
    const res = NextResponse.json({
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
      recovered: false,
    });
    await upsertMembershipOnResponse(res, {
      leagueId: league.id,
      role: "admin",
    });
    return res;
  } catch (e) {
    const message = e instanceof Error ? e.message : "Failed to import league";
    return NextResponse.json({ error: message }, { status: 502 });
  }
}
