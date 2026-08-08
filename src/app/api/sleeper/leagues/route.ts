import { NextResponse } from "next/server";
import { z } from "zod";
import {
  fetchNflState,
  fetchUserByUsername,
  fetchUserLeagues,
} from "@/lib/sleeper";

const schema = z.object({
  username: z.string().min(1).max(40),
});

export async function POST(req: Request) {
  const parsed = schema.safeParse(await req.json());
  if (!parsed.success) {
    return NextResponse.json({ error: "Enter a Sleeper username" }, { status: 400 });
  }

  try {
    const user = await fetchUserByUsername(parsed.data.username);
    if (!user?.user_id) {
      return NextResponse.json({ error: "Sleeper user not found" }, { status: 404 });
    }

    const state = await fetchNflState();
    const season = String(state.league_season || state.season);
    const leagues = await fetchUserLeagues(user.user_id, season);

    return NextResponse.json({
      user: {
        userId: user.user_id,
        username: user.username,
        displayName: user.display_name,
      },
      season,
      leagues: leagues.map((l) => ({
        sleeperLeagueId: l.league_id,
        name: l.name,
        season: String(l.season),
        totalRosters: l.total_rosters,
      })),
    });
  } catch (e) {
    const message = e instanceof Error ? e.message : "Sleeper lookup failed";
    return NextResponse.json({ error: message }, { status: 502 });
  }
}
