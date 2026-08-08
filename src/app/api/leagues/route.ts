import { NextResponse } from "next/server";
import { z } from "zod";
import { findLeagueByAdminCode, findLeagueByInviteCode } from "@/lib/access-code";
import { sessionLeagueIds } from "@/lib/access";
import { jsonWithMembership } from "@/lib/auth-response";
import { prisma } from "@/lib/prisma";
import { getSession } from "@/lib/session";
import { recomputeStarBaselines } from "@/lib/baseline";
import { restoreClaimForSleeperUsername } from "@/lib/claim-restore";
import { verifyDeviceProof } from "@/lib/device-proof";
import { syncLeagueFromSleeper } from "@/lib/sync-league";

const createSchema = z.object({
  sleeperLeagueId: z.string().min(3),
  sleeperUsername: z.string().min(1).max(40).optional(),
  /** Invite or admin code — required to unlock an already-imported league. */
  accessCode: z.string().min(4).optional(),
  /** Signed proof from this device (after a prior successful unlock). */
  deviceProof: z.string().min(20).optional(),
});

export async function GET() {
  const session = await getSession();
  const ids = sessionLeagueIds(session);
  if (ids.length === 0) {
    return NextResponse.json({ leagues: [] });
  }

  const leagues = await prisma.league.findMany({
    where: { id: { in: ids } },
    include: {
      teams: {
        select: {
          id: true,
          displayName: true,
          claimToken: true,
        },
      },
      _count: { select: { baselineValues: true } },
    },
    orderBy: { createdAt: "desc" },
  });

  return NextResponse.json({
    leagues,
    memberships: session.memberships,
  });
}

export async function POST(req: Request) {
  const parsed = createSchema.safeParse(await req.json());
  if (!parsed.success) {
    return NextResponse.json({ error: "Invalid league ID" }, { status: 400 });
  }

  const sleeperLeagueId = parsed.data.sleeperLeagueId.trim();
  const sleeperUsername = parsed.data.sleeperUsername?.trim();
  const accessCode = parsed.data.accessCode?.trim();
  const deviceProofToken = parsed.data.deviceProof?.trim();

  const existing = await prisma.league.findUnique({
    where: { sleeperLeagueId },
  });

  if (existing) {
    // 1) This device already unlocked before
    if (deviceProofToken) {
      const proof = await verifyDeviceProof(deviceProofToken);
      const prior = proof?.memberships.find((m) => m.leagueId === existing.id);
      if (prior) {
        const claim = sleeperUsername
          ? await restoreClaimForSleeperUsername(existing.id, sleeperUsername)
          : null;
        return jsonWithMembership(
          {
            league: {
              id: existing.id,
              name: existing.name,
              sleeperLeagueId: existing.sleeperLeagueId,
              inviteCode: prior.role === "admin" ? existing.inviteCode : undefined,
              adminCode: prior.role === "admin" ? existing.adminCode : undefined,
              scoringType: existing.scoringType,
            },
            alreadyExists: true,
            recovered: true,
            teamRestored: Boolean(claim || prior.teamId),
            message: "Welcome back on this device.",
          },
          {
            leagueId: existing.id,
            role: prior.role,
            teamId: claim?.teamId ?? prior.teamId,
            claimToken: claim?.claimToken ?? prior.claimToken,
          },
          { sleeperUsername },
        );
      }
    }

    // 2) Unlock with invite/admin code (secure)
    if (accessCode) {
      const asAdmin = await findLeagueByAdminCode(accessCode);
      if (asAdmin && asAdmin.id === existing.id) {
        const claim = sleeperUsername
          ? await restoreClaimForSleeperUsername(existing.id, sleeperUsername)
          : null;
        return jsonWithMembership(
          {
            league: {
              id: existing.id,
              name: existing.name,
              sleeperLeagueId: existing.sleeperLeagueId,
              inviteCode: existing.inviteCode,
              adminCode: existing.adminCode,
              scoringType: existing.scoringType,
            },
            alreadyExists: true,
            recovered: true,
            teamRestored: Boolean(claim),
            message: "Unlocked with admin code. This device will remember you.",
          },
          {
            leagueId: existing.id,
            role: "admin",
            teamId: claim?.teamId,
            claimToken: claim?.claimToken,
          },
          { sleeperUsername },
        );
      }

      const asInvite = await findLeagueByInviteCode(accessCode);
      if (asInvite && asInvite.id === existing.id) {
        const claim = sleeperUsername
          ? await restoreClaimForSleeperUsername(existing.id, sleeperUsername)
          : null;
        return jsonWithMembership(
          {
            league: {
              id: existing.id,
              name: existing.name,
              sleeperLeagueId: existing.sleeperLeagueId,
              inviteCode: existing.inviteCode,
              scoringType: existing.scoringType,
            },
            alreadyExists: true,
            recovered: true,
            teamRestored: Boolean(claim),
            message: "Unlocked with invite code. This device will remember you.",
          },
          {
            leagueId: existing.id,
            role: "member",
            teamId: claim?.teamId,
            claimToken: claim?.claimToken,
          },
          { sleeperUsername },
        );
      }

      return NextResponse.json(
        { error: "That code does not match this league" },
        { status: 403 },
      );
    }

    return NextResponse.json({
      league: {
        id: existing.id,
        name: existing.name,
        sleeperLeagueId: existing.sleeperLeagueId,
      },
      alreadyExists: true,
      recovered: false,
      needsCode: true,
      message:
        "League already set up. On a phone that used it before, tap Continue on this device. Otherwise enter the invite or admin code once — then this browser remembers you.",
    });
  }

  try {
    const league = await syncLeagueFromSleeper({ sleeperLeagueId });
    let baseline = null;
    try {
      baseline = await recomputeStarBaselines(league.id);
    } catch {
      // League still usable; admin can retry baseline compute
    }
    return jsonWithMembership(
      {
        league: {
          id: league.id,
          name: league.name,
          sleeperLeagueId: league.sleeperLeagueId,
          inviteCode: league.inviteCode,
          adminCode: league.adminCode,
          scoringType: league.scoringType,
        },
        baseline,
        alreadyExists: false,
        recovered: false,
      },
      { leagueId: league.id, role: "admin" },
      { sleeperUsername },
    );
  } catch (e) {
    const message = e instanceof Error ? e.message : "Failed to import league";
    return NextResponse.json({ error: message }, { status: 502 });
  }
}
