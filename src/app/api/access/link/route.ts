import { NextResponse } from "next/server";
import { z } from "zod";
import { jsonWithSession } from "@/lib/auth-response";
import { createDeviceLinkToken, verifyDeviceLinkToken } from "@/lib/device-proof";
import { getSession } from "@/lib/session";

/** Create a 15-minute sign-in link for another device from the current session. */
export async function POST(req: Request) {
  const session = await getSession();
  if (session.memberships.length === 0) {
    return NextResponse.json({ error: "Sign in on this device first" }, { status: 401 });
  }
  const body = z
    .object({ sleeperUsername: z.string().max(40).optional() })
    .safeParse(await req.json().catch(() => ({})));
  const token = await createDeviceLinkToken(session, {
    sleeperUsername: body.success ? body.data.sleeperUsername || undefined : undefined,
  });
  return NextResponse.json({ path: `/link/${token}`, expiresInMinutes: 15 });
}

/** Redeem a sign-in link on the new device. */
export async function PUT(req: Request) {
  const body = z.object({ token: z.string().min(20) }).safeParse(await req.json());
  if (!body.success) {
    return NextResponse.json({ error: "Missing link" }, { status: 400 });
  }
  const grant = await verifyDeviceLinkToken(body.data.token);
  if (!grant) {
    return NextResponse.json(
      { error: "This sign-in link expired. Make a new one from your other device." },
      { status: 401 },
    );
  }
  const current = await getSession();
  const byLeague = new Map(current.memberships.map((m) => [m.leagueId, m]));
  for (const m of grant.memberships) byLeague.set(m.leagueId, m);
  const memberships = [...byLeague.values()];
  return jsonWithSession(
    {
      ok: true,
      leagueIds: grant.memberships.map((m) => m.leagueId),
      sleeperUsername: grant.sleeperUsername ?? null,
    },
    { memberships },
    { sleeperUsername: grant.sleeperUsername },
  );
}
