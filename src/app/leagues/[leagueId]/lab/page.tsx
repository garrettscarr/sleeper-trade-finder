import Link from "next/link";
import { notFound, redirect } from "next/navigation";
import { ValueLabClient } from "@/components/ValueLabClient";
import { requireClaimedTeam } from "@/lib/access";
import { prisma } from "@/lib/prisma";

type Props = { params: Promise<{ leagueId: string }> };

export default async function ValueLabPage({ params }: Props) {
  const { leagueId } = await params;
  const access = await requireClaimedTeam(leagueId);
  if (access.error || !access.team) redirect(`/leagues/${leagueId}`);

  const league = await prisma.league.findUnique({ where: { id: leagueId } });
  if (!league) notFound();

  return (
    <div className="stack" style={{ paddingBottom: "3rem" }}>
      <div>
        <p className="muted" style={{ margin: 0 }}>
          <Link href={`/leagues/${league.id}`}>{league.name}</Link> / Value Lab
        </p>
        <h1 style={{ margin: "0.35rem 0" }}>Value Lab</h1>
        <p className="muted" style={{ margin: 0 }}>
          Price your players by reacting to mock offers instead of guessing stars.
        </p>
      </div>

      <div className="tabs">
        <Link className="tab" href={`/leagues/${league.id}`}>
          Home
        </Link>
        <Link className="tab" href={`/leagues/${league.id}/values`}>
          My values
        </Link>
        <Link className="tab active" href={`/leagues/${league.id}/lab`}>
          Value Lab
        </Link>
        <Link className="tab" href={`/leagues/${league.id}/finder`}>
          Trade Finder
        </Link>
      </div>

      <ValueLabClient leagueId={league.id} />
    </div>
  );
}
