import { NextResponse } from "next/server";
import { requireAdmin } from "@/lib/access";
import { recomputeStarBaselines } from "@/lib/baseline";

type Params = { params: Promise<{ leagueId: string }> };

/** Recompute 0–5★ baselines from format ADP + projections + season-weighted actuals. */
export async function POST(_req: Request, { params }: Params) {
  const { leagueId } = await params;
  const access = await requireAdmin(leagueId);
  if (access.error) {
    return NextResponse.json({ error: access.error }, { status: 403 });
  }

  try {
    const result = await recomputeStarBaselines(leagueId);
    return NextResponse.json({ ok: true, ...result });
  } catch (e) {
    const message = e instanceof Error ? e.message : "Baseline recompute failed";
    return NextResponse.json({ error: message }, { status: 502 });
  }
}
