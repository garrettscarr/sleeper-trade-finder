import { ensureCommissionerFlags } from "./commissioner";
import { prisma } from "./prisma";
import { randomCode } from "./session";
import { fetchUserByUsername } from "./sleeper";

/**
 * Re-attach session to the Sleeper owner's claimed (or claimable) team.
 * A Sleeper username is public, so it can't take over the commissioner's
 * already-claimed team (that would grant admin) unless the caller already
 * proved admin another way.
 */
export async function restoreClaimForSleeperUsername(
  leagueId: string,
  sleeperUsername: string,
  opts: { allowClaimedCommissioner?: boolean } = {},
): Promise<{ teamId: string; claimToken: string; displayName: string; isCommissioner: boolean } | null> {
  const user = await fetchUserByUsername(sleeperUsername);
  if (!user?.user_id) return null;

  await ensureCommissionerFlags(leagueId);
  const team = await prisma.team.findFirst({
    where: { leagueId, sleeperOwnerId: user.user_id },
  });
  if (!team) return null;
  if (team.isCommissioner && team.claimToken && !opts.allowClaimedCommissioner) return null;

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
