import { ensureCommissionerFlags } from "./commissioner";
import { prisma } from "./prisma";
import {
  getMembership,
  getSession,
  type AppSession,
  type LeagueMembership,
} from "./session";

/** A verified claim on the Sleeper commissioner's team counts as admin — no admin code needed. */
export async function resolveMembership(
  leagueId: string,
  membership: LeagueMembership,
): Promise<LeagueMembership> {
  if (membership.role === "admin" || !membership.teamId || !membership.claimToken) {
    return membership;
  }
  await ensureCommissionerFlags(leagueId);
  const team = await prisma.team.findFirst({
    where: {
      id: membership.teamId,
      leagueId,
      claimToken: membership.claimToken,
      isCommissioner: true,
    },
    select: { id: true },
  });
  return team ? { ...membership, role: "admin" } : membership;
}

export async function requireLeagueAccess(leagueId: string) {
  const session = await getSession();
  const raw = getMembership(session, leagueId);
  if (!raw) {
    return { session, membership: null, error: "Enter this league's invite or admin code" as const };
  }
  const membership = await resolveMembership(leagueId, raw);
  return { session, membership, error: null };
}

export async function requireAdmin(leagueId: string) {
  const access = await requireLeagueAccess(leagueId);
  if (access.error) return access;
  if (access.membership?.role !== "admin") {
    return { ...access, error: "Commissioner access required" as const };
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
