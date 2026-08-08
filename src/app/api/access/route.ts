import { NextResponse } from "next/server";
import { z } from "zod";
import { restoreClaimForSleeperUsername } from "@/lib/claim-restore";
import { prisma } from "@/lib/prisma";
import { upsertMembershipOnResponse } from "@/lib/session";

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

  const code = parsed.data.code.trim().toLowerCase();
  const sleeperUsername = parsed.data.sleeperUsername?.trim();

  const asAdmin = await prisma.league.findFirst({
    where: { adminCode: code },
  });
  if (asAdmin) {
    const claim = sleeperUsername
      ? await restoreClaimForSleeperUsername(asAdmin.id, sleeperUsername)
      : null;
    const res = NextResponse.json({
      leagueId: asAdmin.id,
      role: "admin",
      name: asAdmin.name,
      teamRestored: Boolean(claim),
      teamName: claim?.displayName ?? null,
    });
    await upsertMembershipOnResponse(res, {
      leagueId: asAdmin.id,
      role: "admin",
      teamId: claim?.teamId,
      claimToken: claim?.claimToken,
    });
    return res;
  }

  const asInvite = await prisma.league.findFirst({
    where: { inviteCode: code },
  });
  if (asInvite) {
    const claim = sleeperUsername
      ? await restoreClaimForSleeperUsername(asInvite.id, sleeperUsername)
      : null;
    const res = NextResponse.json({
      leagueId: asInvite.id,
      role: "member",
      name: asInvite.name,
      teamRestored: Boolean(claim),
      teamName: claim?.displayName ?? null,
    });
    await upsertMembershipOnResponse(res, {
      leagueId: asInvite.id,
      role: "member",
      teamId: claim?.teamId,
      claimToken: claim?.claimToken,
    });
    return res;
  }

  return NextResponse.json({ error: "Invalid code" }, { status: 404 });
}
