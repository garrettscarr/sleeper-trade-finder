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
            No accounts · No passwords · Tap your team
          </p>
          <h1>Trade Finder for Sleeper leagues</h1>
          <p>
            Open your league&apos;s invite link and tap your team. This device remembers you.
            The commissioner gets admin automatically by tapping their own team. New phone? Use
            “Sign in on another device” from the one you already use.
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
        <h2 style={{ margin: 0 }}>No invite link handy? Paste the code</h2>
        <EnterCodeForm />
      </div>

      <div className="panel">
        <h2 style={{ marginTop: 0 }}>Commissioner — set up a league</h2>
        <p className="muted">
          Import from Sleeper with your username, then text the <strong>invite link</strong> to
          your league. You&apos;re attached to your own team and admin right away. The admin
          code is only a backup.
        </p>
        <DiscoverLeague />
      </div>
    </section>
  );
}
