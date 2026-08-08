import { prisma } from "./prisma";
import { randomCode } from "./session";
import { fetchUserByUsername } from "./sleeper";

/** Re-attach session to the Sleeper owner's claimed (or claimable) team. */
export async function restoreClaimForSleeperUsername(
  leagueId: string,
  sleeperUsername: string,
): Promise<{ teamId: string; claimToken: string; displayName: string } | null> {
  const user = await fetchUserByUsername(sleeperUsername);
  if (!user?.user_id) return null;

  const team = await prisma.team.findFirst({
    where: { leagueId, sleeperOwnerId: user.user_id },
  });
  if (!team) return null;

  const claimToken = team.claimToken ?? randomCode(12);
  if (!team.claimToken) {
    await prisma.team.update({
      where: { id: team.id },
      data: {
        claimToken,
        claimedLabel: team.claimedLabel || team.displayName,
      },
    });
  }

  return {
    teamId: team.id,
    claimToken,
    displayName: team.claimedLabel || team.displayName,
  };
}
