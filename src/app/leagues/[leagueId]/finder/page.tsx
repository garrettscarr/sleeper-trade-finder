import Link from "next/link";
import { notFound, redirect } from "next/navigation";
import { TradeFinderClient } from "@/components/TradeFinderClient";
import { requireClaimedTeam } from "@/lib/access";
import { prisma } from "@/lib/prisma";

type Props = { params: Promise<{ leagueId: string }> };

export default async function FinderPage({ params }: Props) {
  const { leagueId } = await params;
  const access = await requireClaimedTeam(leagueId);
  if (access.error || !access.team) redirect(`/leagues/${leagueId}`);

  const league = await prisma.league.findUnique({ where: { id: leagueId } });
  if (!league) notFound();

  return (
    <div className="stack" style={{ paddingBottom: "3rem" }}>
      <div>
        <p className="muted" style={{ margin: 0 }}>
          <Link href={`/leagues/${league.id}`}>{league.name}</Link> / Trade Finder
        </p>
        <h1 style={{ margin: "0.35rem 0" }}>Trade Finder</h1>
        <p className="muted" style={{ margin: 0 }}>
          Packages are matched primarily to your partner&apos;s personal values (falling back
          to community baseline when needed).
        </p>
      </div>

      <div className="tabs">
        <Link className="tab" href={`/leagues/${league.id}`}>
          Home
        </Link>
        <Link className="tab" href={`/leagues/${league.id}/values`}>
          My values
        </Link>
        <Link className="tab active" href={`/leagues/${league.id}/finder`}>
          Trade Finder
        </Link>
      </div>

      <TradeFinderClient leagueId={league.id} />
    </div>
  );
}
