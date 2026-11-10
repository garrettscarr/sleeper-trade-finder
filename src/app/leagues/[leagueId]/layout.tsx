import { LeagueTabs } from "@/components/LeagueTabs";
import { resolveMembership } from "@/lib/access";
import { getMembership, getSession } from "@/lib/session";

type Props = {
  children: React.ReactNode;
  params: Promise<{ leagueId: string }>;
};

export default async function LeagueLayout({ children, params }: Props) {
  const { leagueId } = await params;
  const raw = getMembership(await getSession(), leagueId);
  const membership = raw ? await resolveMembership(leagueId, raw) : null;

  return (
    <div className="league-shell">
      {membership ? (
        <LeagueTabs leagueId={leagueId} isAdmin={membership.role === "admin"} />
      ) : null}
      {children}
    </div>
  );
}
