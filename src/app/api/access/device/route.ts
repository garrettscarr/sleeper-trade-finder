import { NextResponse } from "next/server";
import { z } from "zod";
import { jsonWithSession } from "@/lib/auth-response";
import { verifyDeviceProof } from "@/lib/device-proof";
import { restoreClaimForSleeperUsername } from "@/lib/claim-restore";
import type { LeagueMembership } from "@/lib/session";

const schema = z.object({
  deviceProof: z.string().min(20),
  sleeperUsername: z.string().min(1).max(40).optional(),
});

/**
 * Restore session from a signed device proof saved on this phone/browser.
 * No account — possession of the proof (issued after a prior code/import) is the secret.
 */
export async function POST(req: Request) {
  const parsed = schema.safeParse(await req.json());
  if (!parsed.success) {
    return NextResponse.json({ error: "Missing device proof" }, { status: 400 });
  }

  const proof = await verifyDeviceProof(parsed.data.deviceProof);
  if (!proof) {
    return NextResponse.json(
      { error: "Saved login expired or invalid — enter an invite/admin code once" },
      { status: 401 },
    );
  }

  const username = parsed.data.sleeperUsername?.trim() || proof.sleeperUsername;
  const memberships: LeagueMembership[] = [];

  for (const m of proof.memberships) {
    let next = { ...m };
    if (username && (!next.teamId || !next.claimToken)) {
      const claim = await restoreClaimForSleeperUsername(m.leagueId, username);
      if (claim) {
        next = {
          ...next,
          teamId: claim.teamId,
          claimToken: claim.claimToken,
        };
      }
    }
    memberships.push(next);
  }

  return jsonWithSession(
    {
      ok: true,
      memberships,
      sleeperUsername: username ?? null,
      leagueCount: memberships.length,
    },
    { memberships },
    { sleeperUsername: username },
  );
}
