import { NextResponse } from "next/server";
import { z } from "zod";
import { prisma } from "@/lib/prisma";
import { upsertMembershipOnResponse } from "@/lib/session";

const schema = z.object({
  code: z.string().min(4),
});

/** Unlock a league with invite code (member) or admin code (commissioner). */
export async function POST(req: Request) {
  const parsed = schema.safeParse(await req.json());
  if (!parsed.success) {
    return NextResponse.json({ error: "Enter an invite or admin code" }, { status: 400 });
  }

  const code = parsed.data.code.trim().toLowerCase();

  const asAdmin = await prisma.league.findFirst({
    where: { adminCode: code },
  });
  if (asAdmin) {
    const res = NextResponse.json({
      leagueId: asAdmin.id,
      role: "admin",
      name: asAdmin.name,
    });
    await upsertMembershipOnResponse(res, { leagueId: asAdmin.id, role: "admin" });
    return res;
  }

  const asInvite = await prisma.league.findFirst({
    where: { inviteCode: code },
  });
  if (asInvite) {
    const res = NextResponse.json({
      leagueId: asInvite.id,
      role: "member",
      name: asInvite.name,
    });
    await upsertMembershipOnResponse(res, { leagueId: asInvite.id, role: "member" });
    return res;
  }

  return NextResponse.json({ error: "Invalid code" }, { status: 404 });
}
