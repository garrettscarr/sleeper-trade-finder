import Link from "next/link";
import { getSession } from "@/lib/session";

export async function Nav() {
  const session = await getSession();
  const hasSession = session.memberships.length > 0;

  return (
    <header className="nav">
      <Link href={hasSession ? "/dashboard" : "/"} className="brand">
        Sleeper <span>Trade Finder</span>
      </Link>
      <nav className="nav-links">
        {hasSession ? <Link href="/dashboard">My leagues</Link> : <Link href="/">Get started</Link>}
      </nav>
    </header>
  );
}
