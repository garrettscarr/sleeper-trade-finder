import { NextResponse } from "next/server";
import { z } from "zod";
import { requireAdmin } from "@/lib/access";
import { prisma } from "@/lib/prisma";

type Params = { params: Promise<{ leagueId: string }> };

const schema = z.object({
  scoringType: z.enum(["1QB", "SF"]),
});

export async function PATCH(req: Request, { params }: Params) {
  const { leagueId } = await params;
  const access = await requireAdmin(leagueId);
  if (access.error) {
    return NextResponse.json({ error: access.error }, { status: 403 });
  }

  const parsed = schema.safeParse(await req.json());
  if (!parsed.success) {
    return NextResponse.json({ error: "Invalid settings" }, { status: 400 });
  }

  const updated = await prisma.league.update({
    where: { id: leagueId },
    data: { scoringType: parsed.data.scoringType },
  });

  return NextResponse.json({ league: updated });
}
