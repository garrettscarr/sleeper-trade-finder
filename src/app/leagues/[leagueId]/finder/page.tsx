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
    <div className="stack">
      <div>
        <p className="muted" style={{ margin: 0, fontSize: "0.85rem" }}>
          <Link href={`/leagues/${league.id}`}>‹ {league.name}</Link>
        </p>
        <h1 className="page-title">Find trades</h1>
        <p className="muted" style={{ margin: 0, fontSize: "0.9rem" }}>
          Offers are priced on your partner&apos;s own ratings, so they&apos;re ones they&apos;d
          actually take.
        </p>
      </div>

      <TradeFinderClient leagueId={league.id} />
    </div>
  );
}
