import Link from "next/link";
import { notFound, redirect } from "next/navigation";
import { AdminPanel } from "@/components/AdminPanel";
import { requireAdmin } from "@/lib/access";
import { prisma } from "@/lib/prisma";

type Props = { params: Promise<{ leagueId: string }> };

export default async function AdminPage({ params }: Props) {
  const { leagueId } = await params;
  const access = await requireAdmin(leagueId);
  if (access.error) redirect(`/leagues/${leagueId}`);

  const league = await prisma.league.findUnique({ where: { id: leagueId } });
  if (!league) notFound();

  return (
    <div className="stack" style={{ paddingBottom: "3rem" }}>
      <div>
        <p className="muted" style={{ margin: 0 }}>
          <Link href={`/leagues/${league.id}`}>{league.name}</Link> / Admin
        </p>
        <h1 style={{ margin: "0.35rem 0" }}>Admin</h1>
      </div>

      <div className="tabs">
        <Link className="tab" href={`/leagues/${league.id}`}>
          Home
        </Link>
        <Link className="tab" href={`/leagues/${league.id}/values`}>
          My values
        </Link>
        <Link className="tab" href={`/leagues/${league.id}/finder`}>
          Trade Finder
        </Link>
        <Link className="tab active" href={`/leagues/${league.id}/admin`}>
          Admin
        </Link>
      </div>

      <AdminPanel
        leagueId={league.id}
        scoringType={league.scoringType}
        baselineSource={league.baselineSource}
        inviteCode={league.inviteCode}
        adminCode={league.adminCode}
      />
    </div>
  );
}
