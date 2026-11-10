import Link from "next/link";
import { notFound, redirect } from "next/navigation";
import { ClaimTeamForm } from "@/components/ClaimTeamForm";
import { CopyAdminLink, CopyInviteLink } from "@/components/CopyInviteLink";
import { PlayerPhoto } from "@/components/PlayerPhoto";
import { formatLabel } from "@/lib/league-format";
import { SignInAnotherDevice } from "@/components/SignInAnotherDevice";
import { requireLeagueAccess } from "@/lib/access";
import { prisma } from "@/lib/prisma";

type Props = { params: Promise<{ leagueId: string }> };

/** Relative time, so it reads right regardless of the server's timezone. */
function timeAgo(date: Date): string {
  const minutes = Math.max(0, Math.round((Date.now() - date.getTime()) / 60000));
  if (minutes < 1) return "just now";
  if (minutes < 60) return `${minutes} min ago`;
  return `${Math.round(minutes / 60)} hr ago`;
}

export default async function LeagueHomePage({ params }: Props) {
  const { leagueId } = await params;
  const access = await requireLeagueAccess(leagueId);
  const membership = access.membership;
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

  const syncedAt = league.lastSyncedAt ? timeAgo(league.lastSyncedAt) : null;

  return (
    <div className="stack" style={{ paddingBottom: "1rem" }}>
      <div>
        <p className="muted" style={{ margin: 0, fontSize: "0.85rem" }}>
          <Link href="/dashboard">‹ My leagues</Link>
        </p>
        <h1 className="page-title">{league.name}</h1>
        <p className="muted" style={{ margin: 0, fontSize: "0.85rem" }}>
          {league.season} · {formatLabel(league.format)} · {league.scoringType}
          {isAdmin ? " · you're commissioner" : ""}
          {syncedAt ? ` · rosters updated ${syncedAt}` : ""}
        </p>
      </div>

      {myTeam ? (
        <div className="panel stack">
          <div className="group-head">
            <PlayerPhoto sleeperAvatarId={myTeam.avatar} name={myTeam.displayName} size={36} />
            <strong style={{ fontSize: "1.05rem" }}>
              {myTeam.claimedLabel || myTeam.teamName || myTeam.displayName}
            </strong>
          </div>
          <div className="action-list">
            <Link className="btn" href={`/leagues/${league.id}/lab`}>
              Price my players with mock trades
            </Link>
            <Link className="btn btn-secondary" href={`/leagues/${league.id}/finder`}>
              Find trades
            </Link>
            <Link className="btn btn-secondary" href={`/leagues/${league.id}/values`}>
              Edit my ratings
            </Link>
          </div>
          {league._count.baselineValues === 0 ? (
            <p className="muted" style={{ margin: 0, fontSize: "0.85rem" }}>
              Market ratings aren&apos;t computed yet. The commissioner can run them from Admin.
            </p>
          ) : null}
        </div>
      ) : (
        <div className="panel">
          <h2 style={{ marginTop: 0 }}>Which team is yours?</h2>
          <ClaimTeamForm
            leagueId={league.id}
            teams={league.teams.map((t) => ({
              id: t.id,
              label: t.teamName ? `${t.teamName} (${t.displayName})` : t.displayName,
              avatar: t.avatar,
              claimed: Boolean(t.claimToken) && t.id !== membership.teamId,
              isCommissioner: t.isCommissioner,
            }))}
          />
        </div>
      )}

      <div className="panel stack">
        <h2 style={{ margin: 0 }}>Teams</h2>
        <div className="team-list">
          {league.teams.map((team) => {
            const c = completionByTeam.get(team.id);
            return (
              <div className="team-list-row" key={team.id}>
                <PlayerPhoto sleeperAvatarId={team.avatar} name={team.displayName} size={32} />
                <div style={{ minWidth: 0, flex: 1 }}>
                  <div className="asset-name">{team.teamName || team.displayName}</div>
                  {team.teamName ? (
                    <div className="asset-meta">{team.displayName}</div>
                  ) : null}
                </div>
                {team.claimToken ? (
                  <span className={`pill ${c?.status === "ready" ? "love" : "fair"}`}>
                    {c?.pct ?? 0}% rated
                  </span>
                ) : (
                  <span className="pill">not on app</span>
                )}
              </div>
            );
          })}
        </div>
      </div>

      <div className="panel stack">
        <h2 style={{ margin: 0 }}>Invite your league</h2>
        <p className="muted" style={{ margin: 0, fontSize: "0.9rem" }}>
          League mates can just enter their Sleeper username on the home page, or open this link:
        </p>
        <CopyInviteLink inviteCode={league.inviteCode} />
        {isAdmin ? (
          <details>
            <summary className="muted" style={{ cursor: "pointer", fontSize: "0.85rem" }}>
              Backup admin code (private)
            </summary>
            <div style={{ marginTop: "0.5rem" }}>
              <CopyAdminLink adminCode={league.adminCode} />
            </div>
          </details>
        ) : null}
      </div>

      {myTeam ? (
        <div className="panel stack">
          <h2 style={{ margin: 0 }}>Your other devices</h2>
          <SignInAnotherDevice />
        </div>
      ) : null}
    </div>
  );
}
