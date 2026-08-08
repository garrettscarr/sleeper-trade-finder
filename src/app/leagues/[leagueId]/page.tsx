import Link from "next/link";
import { notFound, redirect } from "next/navigation";
import { ClaimTeamForm } from "@/components/ClaimTeamForm";
import { CopyInviteLink } from "@/components/CopyInviteLink";
import { prisma } from "@/lib/prisma";
import { getMembership, getSession } from "@/lib/session";

type Props = { params: Promise<{ leagueId: string }> };

export default async function LeagueHomePage({ params }: Props) {
  const { leagueId } = await params;
  const session = await getSession();
  const membership = getMembership(session, leagueId);
  if (!membership) redirect(`/join`);

  const league = await prisma.league.findUnique({
    where: { id: leagueId },
    include: {
      teams: { orderBy: { displayName: "asc" } },
      _count: { select: { baselineValues: true } },
    },
  });
  if (!league) notFound();

  const isAdmin = membership.role === "admin";
  const myTeam = league.teams.find(
    (t) =>
      membership.teamId === t.id &&
      membership.claimToken &&
      t.claimToken === membership.claimToken,
  );

  const completion = await Promise.all(
    league.teams.map(async (team) => {
      if (!team.claimToken) {
        return { teamId: team.id, pct: 0, status: "unclaimed" as const };
      }
      const rosterCount = (JSON.parse(team.playerIds || "[]") as string[]).length;
      const valued = await prisma.personalValue.count({ where: { teamId: team.id } });
      const pct = rosterCount === 0 ? 0 : Math.min(100, Math.round((valued / rosterCount) * 100));
      return {
        teamId: team.id,
        pct,
        status: pct >= 80 ? ("ready" as const) : ("partial" as const),
      };
    }),
  );
  const completionByTeam = new Map(completion.map((c) => [c.teamId, c]));

  return (
    <div className="stack" style={{ paddingBottom: "3rem" }}>
      <div>
        <p className="muted" style={{ margin: 0 }}>
          <Link href="/dashboard">Leagues</Link> / {league.name}
        </p>
        <h1 style={{ margin: "0.35rem 0", letterSpacing: "-0.03em" }}>{league.name}</h1>
        <p className="muted" style={{ margin: 0 }}>
          Season {league.season} · {league.scoringType} · Sleeper {league.sleeperLeagueId}
          {league.lastSyncedAt ? ` · synced ${league.lastSyncedAt.toLocaleString()}` : ""}
        </p>
      </div>

      <div className="tabs">
        <Link className="tab active" href={`/leagues/${league.id}`}>
          Home
        </Link>
        <Link className="tab" href={`/leagues/${league.id}/values`}>
          My values
        </Link>
        <Link className="tab" href={`/leagues/${league.id}/finder`}>
          Trade Finder
        </Link>
        {isAdmin ? (
          <Link className="tab" href={`/leagues/${league.id}/admin`}>
            Admin
          </Link>
        ) : null}
      </div>

      <div className="grid-2">
        <div className="panel stack">
          <h2 style={{ margin: 0 }}>League status</h2>
          <p className="muted" style={{ margin: 0 }}>
            Star baselines:{" "}
            {league._count.baselineValues > 0
              ? `${league._count.baselineValues} players (${league.baselineSource || "computed"})`
              : "not computed yet — admin can recompute"}
          </p>
          <p className="muted" style={{ margin: 0 }}>
            Your role: {membership.role}
            {myTeam
              ? ` · team ${myTeam.claimedLabel || myTeam.teamName || myTeam.displayName}`
              : " · team not claimed"}
          </p>
          {myTeam ? (
            <div style={{ display: "flex", gap: "0.5rem", flexWrap: "wrap" }}>
              <Link className="btn" href={`/leagues/${league.id}/values`}>
                Edit my values
              </Link>
              <Link className="btn btn-secondary" href={`/leagues/${league.id}/finder`}>
                Open Trade Finder
              </Link>
            </div>
          ) : (
            <p className="muted" style={{ margin: 0 }}>
              Claim your Sleeper team below to start a personal board.
            </p>
          )}
        </div>

        <div className="panel stack">
          <h2 style={{ margin: 0 }}>Invite managers</h2>
          {isAdmin ? (
            <>
              <p className="muted" style={{ margin: 0 }}>
                Copy the full link and text it to your league (not the admin code):
              </p>
              <CopyInviteLink inviteCode={league.inviteCode} />
              <p className="muted" style={{ margin: 0, fontSize: "0.85rem" }}>
                Invite code: <strong>{league.inviteCode}</strong>
              </p>
              <p className="muted" style={{ margin: 0, fontSize: "0.85rem" }}>
                Admin code (private): <strong>{league.adminCode}</strong>
              </p>
            </>
          ) : (
            <p className="muted" style={{ margin: 0 }}>
              Ask your commissioner for the invite code if a league mate still needs access.
            </p>
          )}
        </div>
      </div>

      {!myTeam ? (
        <div className="panel">
          <h2 style={{ marginTop: 0 }}>Claim your team</h2>
          <ClaimTeamForm
            leagueId={league.id}
            teams={league.teams.map((t) => ({
              id: t.id,
              label: t.teamName ? `${t.teamName} (${t.displayName})` : t.displayName,
              claimed: Boolean(t.claimToken) && t.id !== membership.teamId,
            }))}
          />
        </div>
      ) : null}

      <div className="panel">
        <h2 style={{ marginTop: 0 }}>Teams</h2>
        <table className="table">
          <thead>
            <tr>
              <th>Manager</th>
              <th>Team</th>
              <th>Claim</th>
              <th>Values</th>
            </tr>
          </thead>
          <tbody>
            {league.teams.map((team) => {
              const c = completionByTeam.get(team.id);
              return (
                <tr key={team.id}>
                  <td>{team.displayName}</td>
                  <td>{team.teamName || "—"}</td>
                  <td>
                    {team.claimToken ? (
                      <span className="pill love">claimed</span>
                    ) : (
                      <span className="pill">open</span>
                    )}
                  </td>
                  <td>
                    {!team.claimToken ? (
                      <span className="muted">—</span>
                    ) : (
                      <span className={`pill ${c?.status === "ready" ? "love" : "fair"}`}>
                        {c?.pct ?? 0}% board
                      </span>
                    )}
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>
    </div>
  );
}
