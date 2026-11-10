import { NextResponse } from "next/server";
import { z } from "zod";
import { requireLeagueAccess } from "@/lib/access";
import { jsonWithMembership } from "@/lib/auth-response";
import { restoreClaimForSleeperUsername } from "@/lib/claim-restore";
import { ensureCommissionerFlags } from "@/lib/commissioner";
import { prisma } from "@/lib/prisma";
import { randomCode } from "@/lib/session";
import { fetchUserByUsername } from "@/lib/sleeper";
import { seedPersonalValuesForTeam } from "@/lib/sync-league";

type Params = { params: Promise<{ leagueId: string }> };

const schema = z.object({
  teamId: z.string().min(1),
  label: z.string().max(40).optional(),
  sleeperUsername: z.string().min(1).max(40).optional(),
});

const COMMISSIONER_TEAM_LOCKED =
  "That's the commissioner's team and it's already signed in elsewhere. Use “Sign in on another device” from that phone, or the admin code.";

export async function POST(req: Request, { params }: Params) {
  const { leagueId } = await params;
  const access = await requireLeagueAccess(leagueId);
  if (access.error) {
    return NextResponse.json({ error: access.error }, { status: 403 });
  }

  const parsed = schema.safeParse(await req.json());
  if (!parsed.success) {
    return NextResponse.json({ error: "Invalid request" }, { status: 400 });
  }

  await ensureCommissionerFlags(leagueId);
  const team = await prisma.team.findFirst({
    where: { id: parsed.data.teamId, leagueId },
  });
  if (!team) {
    return NextResponse.json({ error: "Team not found" }, { status: 404 });
  }

  const membership = access.membership!;
  const role = team.isCommissioner ? "admin" : membership.role;
  const ownsThis =
    membership.teamId === team.id &&
    membership.claimToken &&
    team.claimToken === membership.claimToken;

  // True Sleeper roster owner can reattach even if this browser lost its claim cookie.
  let ownerOverride = false;
  if (team.claimToken && !ownsThis && parsed.data.sleeperUsername) {
    if (team.isCommissioner && membership.role !== "admin") {
      return NextResponse.json({ error: COMMISSIONER_TEAM_LOCKED }, { status: 409 });
    }
    const user = await fetchUserByUsername(parsed.data.sleeperUsername);
    if (user?.user_id && team.sleeperOwnerId === user.user_id) {
      ownerOverride = true;
    }
  }

  if (team.claimToken && !ownsThis && !ownerOverride) {
    return NextResponse.json(
      {
        error: team.isCommissioner
          ? COMMISSIONER_TEAM_LOCKED
          : "Team already claimed. If it's yours, enter your Sleeper username to reconnect.",
        needsUsername: !team.isCommissioner,
      },
      { status: 409 },
    );
  }

  if (ownerOverride && team.claimToken) {
    await seedPersonalValuesForTeam(leagueId, team.id);
    return jsonWithMembership(
      { team },
      { leagueId, role, teamId: team.id, claimToken: team.claimToken },
      { sleeperUsername: parsed.data.sleeperUsername },
    );
  }

  // Release previous claim from this browser in this league
  if (membership.teamId && membership.claimToken && membership.teamId !== team.id) {
    await prisma.team.updateMany({
      where: {
        id: membership.teamId,
        leagueId,
        claimToken: membership.claimToken,
      },
      data: { claimToken: null, claimedLabel: null },
    });
  }

  const claimToken = team.claimToken && ownsThis ? team.claimToken : randomCode(12);
  const updated = await prisma.team.update({
    where: { id: team.id },
    data: {
      claimToken,
      claimedLabel: parsed.data.label?.trim() || team.claimedLabel || team.displayName,
    },
  });

  await seedPersonalValuesForTeam(leagueId, team.id);

  return jsonWithMembership(
    { team: updated, isCommissioner: team.isCommissioner },
    { leagueId, role, teamId: updated.id, claimToken },
    { sleeperUsername: parsed.data.sleeperUsername },
  );
}

/** Reconnect this browser to your Sleeper team without picking from the list. */
export async function PUT(req: Request, { params }: Params) {
  const { leagueId } = await params;
  const access = await requireLeagueAccess(leagueId);
  if (access.error) {
    return NextResponse.json({ error: access.error }, { status: 403 });
  }

  const body = z
    .object({ sleeperUsername: z.string().min(1).max(40) })
    .safeParse(await req.json());
  if (!body.success) {
    return NextResponse.json({ error: "Enter your Sleeper username" }, { status: 400 });
  }

  const membership = access.membership!;
  const claim = await restoreClaimForSleeperUsername(leagueId, body.data.sleeperUsername, {
    allowClaimedCommissioner: membership.role === "admin",
  });
  if (!claim) {
    return NextResponse.json(
      {
        error: `No open team matches that Sleeper username. ${COMMISSIONER_TEAM_LOCKED.replace("That's", "If it's")}`,
      },
      { status: 404 },
    );
  }

  return jsonWithMembership(
    { teamId: claim.teamId, displayName: claim.displayName },
    {
      leagueId,
      role: claim.isCommissioner ? "admin" : membership.role,
      teamId: claim.teamId,
      claimToken: claim.claimToken,
    },
    { sleeperUsername: body.data.sleeperUsername },
  );
}
