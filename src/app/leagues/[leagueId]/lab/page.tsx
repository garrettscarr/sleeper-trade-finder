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
    <div className="stack">
      <div>
        <p className="muted" style={{ margin: 0, fontSize: "0.85rem" }}>
          <Link href={`/leagues/${league.id}`}>‹ {league.name}</Link>
        </p>
        <h1 className="page-title">Value Lab</h1>
        <p className="muted" style={{ margin: 0, fontSize: "0.9rem" }}>
          Pick the offers you&apos;d take and your ratings set themselves.
        </p>
      </div>

      <ValueLabClient leagueId={league.id} />
    </div>
  );
}
