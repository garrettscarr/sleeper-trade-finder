import Link from "next/link";
import { ContinueOnDevice } from "@/components/ContinueOnDevice";
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
            No accounts · Device remembers you · Codes only when needed
          </p>
          <h1>Trade Finder for Sleeper leagues</h1>
          <p>
            Unlock once with an invite link or code. This browser keeps you signed in — no
            email or password. New phone? Paste the code once again.
          </p>
          {session.memberships.length > 0 ? (
            <div style={{ marginTop: "1.25rem" }}>
              <Link href="/dashboard" className="btn">
                Open my leagues
              </Link>
            </div>
          ) : null}
        </div>
      </div>

      <ContinueOnDevice />

      <div className="panel stack">
        <h2 style={{ margin: 0 }}>Have a code? (first time on this phone)</h2>
        <EnterCodeForm />
      </div>

      <div className="panel">
        <h2 style={{ marginTop: 0 }}>Commissioner — set up a league</h2>
        <p className="muted">
          Import from Sleeper, then share the <strong>invite link</strong> with managers.
          Keep the <strong>admin code</strong> private. This device will remember your
          admin access after setup.
        </p>
        <DiscoverLeague />
      </div>
    </section>
  );
}
