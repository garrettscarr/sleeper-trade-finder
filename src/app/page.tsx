import Link from "next/link";
import { DiscoverLeague } from "@/components/DiscoverLeague";
import { EnterCodeForm } from "@/components/EnterCodeForm";
import { getSession } from "@/lib/session";

export default async function HomePage() {
  const session = await getSession();

  return (
    <section className="stack" style={{ paddingBottom: "3rem" }}>
      <div className="hero" style={{ paddingBottom: "1rem" }}>
        <div>
          <p className="pill fair" style={{ marginBottom: "1rem" }}>
            No emails · No passwords · Invite codes only
          </p>
          <h1>Trade Finder for Sleeper leagues</h1>
          <p>
            Look up leagues with a Sleeper username or league ID (public Sleeper data only).
            Managers join with an invite code — never by creating an account.
          </p>
          {session.memberships.length > 0 ? (
            <div style={{ marginTop: "1.25rem" }}>
              <Link href="/dashboard" className="btn">
                Open my leagues
              </Link>
            </div>
          ) : null}
        </div>
        <div className="panel stack">
          <h2 style={{ margin: 0 }}>Already have a code?</h2>
          <EnterCodeForm />
        </div>
      </div>

      <div className="panel">
        <h2 style={{ marginTop: 0 }}>Set up a league</h2>
        <p className="muted">
          Commissioner flow: find the league, import it, then share the <strong>invite code</strong>{" "}
          with managers. Keep the <strong>admin code</strong> private for sync/baseline tools.
        </p>
        <DiscoverLeague />
      </div>
    </section>
  );
}
