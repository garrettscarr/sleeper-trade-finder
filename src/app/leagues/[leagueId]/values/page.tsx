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
    <div className="stack">
      <div>
        <p className="muted" style={{ margin: 0, fontSize: "0.85rem" }}>
          <Link href={`/leagues/${league.id}`}>‹ {league.name}</Link>
        </p>
        <h1 className="page-title">My ratings</h1>
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
