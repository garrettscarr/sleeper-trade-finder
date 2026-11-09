import { NextResponse } from "next/server";
import { requireLeagueAccess } from "@/lib/access";
import { getLeagueTradeHistory } from "@/lib/trade-history";

type Params = { params: Promise<{ leagueId: string }> };

export async function GET(_req: Request, { params }: Params) {
  const { leagueId } = await params;
  const access = await requireLeagueAccess(leagueId);
  if (access.error) {
    return NextResponse.json({ error: access.error }, { status: 403 });
  }
  try {
    const trades = await getLeagueTradeHistory(leagueId);
    return NextResponse.json({ trades });
  } catch (e) {
    const message = e instanceof Error ? e.message : "Could not load trade history";
    return NextResponse.json({ error: message, trades: [] }, { status: 502 });
  }
}
