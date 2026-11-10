import { NextResponse } from "next/server";
import { z } from "zod";
import { jsonWithMembership } from "@/lib/auth-response";
import { recomputeStarBaselines } from "@/lib/baseline";
import { restoreClaimForSleeperUsername } from "@/lib/claim-restore";
import { prisma } from "@/lib/prisma";
import { getMembership, getSession } from "@/lib/session";
import { fetchLeagueUsers, fetchUserByUsername } from "@/lib/sleeper";
import { syncLeagueFromSleeper } from "@/lib/sync-league";

// First-time imports pull rosters, players, and projections from Sleeper.
export const maxDuration = 120;

const schema = z.object({
  sleeperLeagueId: z.string().min(3),
  sleeperUsername: z.string().min(1).max(40),
});

/**
 * Set up (if new) or join one Sleeper league for this username, and attach the
 * user's own team when it's free. Commissioner access still only comes from
 * holding the commissioner's team, never from the username alone.
 */
export async function POST(req: Request) {
  const parsed = schema.safeParse(await req.json());
  if (!parsed.success) {
    return NextResponse.json({ error: "Invalid request" }, { status: 400 });
  }
  const sleeperLeagueId = parsed.data.sleeperLeagueId.trim();
  const sleeperUsername = parsed.data.sleeperUsername.trim();

  const [user, leagueUsers] = await Promise.all([
    fetchUserByUsername(sleeperUsername).catch(() => null),
    fetchLeagueUsers(sleeperLeagueId).catch(() => []),
  ]);
  if (!user?.user_id) {
    return NextResponse.json({ error: "Sleeper user not found" }, { status: 404 });
  }
  if (!leagueUsers.some((u) => u.user_id === user.user_id)) {
    return NextResponse.json({ error: "You're not in this Sleeper league" }, { status: 403 });
  }

  let league = await prisma.league.findUnique({ where: { sleeperLeagueId } });
  let created = false;
  if (!league) {
    try {
      league = await syncLeagueFromSleeper({ sleeperLeagueId });
      created = true;
    } catch (e) {
      // Someone else may have imported it at the same moment.
      league = await prisma.league.findUnique({ where: { sleeperLeagueId } });
      if (!league) {
        const message = e instanceof Error ? e.message : "Failed to set up league";
        return NextResponse.json({ error: message }, { status: 502 });
      }
    }
    if (created) {
      await recomputeStarBaselines(league.id).catch(() => undefined);
    }
  }

  const prior = getMembership(await getSession(), league.id);
  const claim = prior?.teamId
    ? null
    : await restoreClaimForSleeperUsername(league.id, sleeperUsername, {
        allowClaimedCommissioner: prior?.role === "admin",
      }).catch(() => null);

  const teamId = prior?.teamId ?? claim?.teamId;
  const claimToken = prior?.claimToken ?? claim?.claimToken;
  const role = prior?.role === "admin" || claim?.isCommissioner ? "admin" : "member";
  const team = teamId
    ? await prisma.team.findUnique({ where: { id: teamId } })
    : null;

  return jsonWithMembership(
    {
      league: { id: league.id, name: league.name, season: league.season },
      created,
      role,
      teamAttached: Boolean(teamId),
      teamName: team ? team.claimedLabel || team.teamName || team.displayName : null,
    },
    { leagueId: league.id, role, teamId, claimToken },
    { sleeperUsername },
  );
}
