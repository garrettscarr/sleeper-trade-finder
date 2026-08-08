import Link from "next/link";
import { getSession } from "@/lib/session";
import { ClearSessionButton } from "./ClearSessionButton";

export async function Nav() {
  const session = await getSession();
  const hasSession = session.memberships.length > 0;

  return (
    <header className="nav">
      <Link href="/" className="brand">
        Sleeper <span>Trade Finder</span>
      </Link>
      <nav className="nav-links">
        <Link href="/">Home</Link>
        {hasSession ? <Link href="/dashboard">My leagues</Link> : null}
        <Link href="/join">Enter code</Link>
        {hasSession ? <ClearSessionButton /> : null}
      </nav>
    </header>
  );
}
