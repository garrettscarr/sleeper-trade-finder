import { ensureCommissionerFlags } from "./commissioner";
import { prisma } from "./prisma";
import { randomCode } from "./session";
import { fetchUserByUsername } from "./sleeper";

/**
 * Attach this session to the Sleeper user's own team. If the team is already
 * claimed on another device, this device shares that claim so both stay signed in.
 */
export async function restoreClaimForSleeperUsername(
  leagueId: string,
  sleeperUsername: string,
): Promise<{ teamId: string; claimToken: string; displayName: string; isCommissioner: boolean } | null> {
  const user = await fetchUserByUsername(sleeperUsername);
  if (!user?.user_id) return null;

  await ensureCommissionerFlags(leagueId);
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
    isCommissioner: team.isCommissioner,
  };
}
