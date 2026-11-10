import { prisma } from "./prisma";
import { fetchLeagueUsers } from "./sleeper";

/** Leagues imported before the commissioner flag existed get it filled from Sleeper once. */
export async function ensureCommissionerFlags(leagueId: string) {
  const flagged = await prisma.team.count({ where: { leagueId, isCommissioner: true } });
  if (flagged > 0) return;
  const league = await prisma.league.findUnique({ where: { id: leagueId } });
  if (!league) return;
  try {
    const users = await fetchLeagueUsers(league.sleeperLeagueId);
    const ownerIds = users.filter((u) => u.is_owner).map((u) => u.user_id);
    if (ownerIds.length === 0) return;
    await prisma.team.updateMany({
      where: { leagueId, sleeperOwnerId: { in: ownerIds } },
      data: { isCommissioner: true },
    });
  } catch {
    // Sleeper down: admin code still works as a fallback
  }
}
