import Link from "next/link";
import { prisma } from "@/lib/prisma";
import { getMembership, getSession } from "@/lib/session";

export default async function DashboardPage() {
  const session = await getSession();
  const ids = session.memberships.map((m) => m.leagueId);

  const leagues =
    ids.length === 0
      ? []
      : await prisma.league.findMany({
          where: { id: { in: ids } },
          include: { teams: true, _count: { select: { baselineValues: true } } },
          orderBy: { createdAt: "desc" },
        });

  return (
    <div className="stack" style={{ paddingBottom: "3rem" }}>
      <div style={{ display: "flex", justifyContent: "space-between", gap: "1rem", flexWrap: "wrap" }}>
        <div>
          <h1 style={{ margin: "0 0 0.35rem", letterSpacing: "-0.03em" }}>My leagues</h1>
          <p className="muted" style={{ margin: 0 }}>
            Leagues unlocked on this browser via invite or admin code.
          </p>
        </div>
        <Link href="/" className="btn">
          Add league
        </Link>
      </div>

      {leagues.length === 0 ? (
        <div className="panel">
          <p style={{ marginTop: 0 }}>No leagues on this device yet.</p>
          <Link href="/" className="btn">
            Find a league or enter a code
          </Link>
        </div>
      ) : (
        <div className="stack">
          {leagues.map((league) => {
            const membership = getMembership(session, league.id);
            const claimed = league.teams.filter((t) => t.claimToken).length;
            const myTeam = league.teams.find(
              (t) =>
                membership?.teamId === t.id &&
                membership.claimToken &&
                t.claimToken === membership.claimToken,
            );
            return (
              <Link key={league.id} href={`/leagues/${league.id}`} className="panel">
                <div style={{ display: "flex", justifyContent: "space-between", gap: "1rem" }}>
                  <div>
                    <h2 style={{ margin: "0 0 0.35rem" }}>{league.name}</h2>
                    <p className="muted" style={{ margin: 0 }}>
                      Season {league.season} · {league.scoringType} · {claimed}/
                      {league.teams.length} teams claimed
                      {membership ? ` · you are ${membership.role}` : ""}
                    </p>
                    {myTeam ? (
                      <p className="success" style={{ margin: "0.4rem 0 0" }}>
                        Your team: {myTeam.claimedLabel || myTeam.teamName || myTeam.displayName}
                      </p>
                    ) : (
                      <p className="muted" style={{ margin: "0.4rem 0 0" }}>
                        Team not claimed yet
                      </p>
                    )}
                  </div>
                  <span className="pill">{league.sleeperLeagueId}</span>
                </div>
              </Link>
            );
          })}
        </div>
      )}
    </div>
  );
}
