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
    <div className="stack">
      <div>
        <p className="muted" style={{ margin: 0, fontSize: "0.85rem" }}>
          <Link href={`/leagues/${league.id}`}>‹ {league.name}</Link>
        </p>
        <h1 className="page-title">Admin</h1>
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
