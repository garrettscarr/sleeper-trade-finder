import { NextResponse } from "next/server";
import { z } from "zod";
import { findLeagueByAdminCode, findLeagueByInviteCode } from "@/lib/access-code";
import { jsonWithMembership } from "@/lib/auth-response";
import { restoreClaimForSleeperUsername } from "@/lib/claim-restore";

const schema = z.object({
  code: z.string().min(4),
  sleeperUsername: z.string().min(1).max(40).optional(),
});

/** Unlock a league with invite code (member) or admin code (commissioner). */
export async function POST(req: Request) {
  const parsed = schema.safeParse(await req.json());
  if (!parsed.success) {
    return NextResponse.json({ error: "Enter an invite or admin code" }, { status: 400 });
  }

  const code = parsed.data.code;
  const sleeperUsername = parsed.data.sleeperUsername?.trim();

  const asAdmin = await findLeagueByAdminCode(code);
  if (asAdmin) {
    const claim = sleeperUsername
      ? await restoreClaimForSleeperUsername(asAdmin.id, sleeperUsername)
      : null;
    return jsonWithMembership(
      {
        leagueId: asAdmin.id,
        role: "admin",
        name: asAdmin.name,
        inviteCode: asAdmin.inviteCode,
        adminCode: asAdmin.adminCode,
        teamRestored: Boolean(claim),
        teamName: claim?.displayName ?? null,
      },
      {
        leagueId: asAdmin.id,
        role: "admin",
        teamId: claim?.teamId,
        claimToken: claim?.claimToken,
      },
      { sleeperUsername },
    );
  }

  const asInvite = await findLeagueByInviteCode(code);
  if (asInvite) {
    const claim = sleeperUsername
      ? await restoreClaimForSleeperUsername(asInvite.id, sleeperUsername)
      : null;
    return jsonWithMembership(
      {
        leagueId: asInvite.id,
        role: "member",
        name: asInvite.name,
        inviteCode: asInvite.inviteCode,
        teamRestored: Boolean(claim),
        teamName: claim?.displayName ?? null,
      },
      {
        leagueId: asInvite.id,
        role: "member",
        teamId: claim?.teamId,
        claimToken: claim?.claimToken,
      },
      { sleeperUsername },
    );
  }

  return NextResponse.json({ error: "Invalid code" }, { status: 404 });
}
