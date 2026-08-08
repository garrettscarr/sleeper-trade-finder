import { prisma } from "./prisma";
import { getMembership, getSession, type AppSession } from "./session";

export async function requireLeagueAccess(leagueId: string) {
  const session = await getSession();
  const membership = getMembership(session, leagueId);
  if (!membership) {
    return { session, membership: null, error: "Enter this league's invite or admin code" as const };
  }
  return { session, membership, error: null };
}

export async function requireAdmin(leagueId: string) {
  const access = await requireLeagueAccess(leagueId);
  if (access.error) return access;
  if (access.membership?.role !== "admin") {
    return { ...access, error: "Commissioner admin code required" as const };
  }
  return { ...access, error: null };
}

export async function requireClaimedTeam(leagueId: string) {
  const access = await requireLeagueAccess(leagueId);
  if (access.error) return { ...access, team: null };
  if (!access.membership?.teamId || !access.membership.claimToken) {
    return { ...access, team: null, error: "Claim a team first" as const };
  }
  const team = await prisma.team.findFirst({
    where: {
      id: access.membership.teamId,
      leagueId,
      claimToken: access.membership.claimToken,
    },
  });
  if (!team) {
    return { ...access, team: null, error: "Team claim expired — reclaim with invite code" as const };
  }
  return { ...access, team, error: null };
}

export function sessionLeagueIds(session: AppSession) {
  return session.memberships.map((m) => m.leagueId);
}
