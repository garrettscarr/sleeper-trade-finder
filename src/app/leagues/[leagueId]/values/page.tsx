import Link from "next/link";
import { notFound, redirect } from "next/navigation";
import { ValuesEditor } from "@/components/ValuesEditor";
import { requireClaimedTeam } from "@/lib/access";
import { prisma } from "@/lib/prisma";
import { buildValuesPayload } from "@/lib/values-payload";

type Props = { params: Promise<{ leagueId: string }> };

export default async function ValuesPage({ params }: Props) {
  const { leagueId } = await params;
  const access = await requireClaimedTeam(leagueId);
  if (access.error || !access.team) redirect(`/leagues/${leagueId}`);

  const league = await prisma.league.findUnique({ where: { id: leagueId } });
  if (!league) notFound();

  const payload = await buildValuesPayload(leagueId, access.team.id);

  return (
    <div className="stack" style={{ paddingBottom: "3rem" }}>
      <div>
        <p className="muted" style={{ margin: 0 }}>
          <Link href={`/leagues/${league.id}`}>{league.name}</Link> / My values
        </p>
        <h1 style={{ margin: "0.35rem 0" }}>My values</h1>
        <p className="muted" style={{ margin: 0 }}>
          Compare your board to the live league consensus as managers save ratings.
        </p>
      </div>

      <div className="tabs">
        <Link className="tab" href={`/leagues/${league.id}`}>
          Home
        </Link>
        <Link className="tab active" href={`/leagues/${league.id}/values`}>
          My values
        </Link>
        <Link className="tab" href={`/leagues/${league.id}/finder`}>
          Trade Finder
        </Link>
      </div>

      <ValuesEditor
        leagueId={league.id}
        initialRoster={payload.roster}
        initialLeagueAssets={payload.leagueAssets}
        teamFilters={payload.teamFilters}
        claimedManagers={payload.claimedManagers}
      />
    </div>
  );
}
