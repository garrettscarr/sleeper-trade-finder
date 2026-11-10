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
            No accounts · No passwords · Just your Sleeper username
          </p>
          <h1>Trade Finder for Sleeper leagues</h1>
          <p>
            Enter your Sleeper username and every league you&apos;re in shows up, ready to go,
            with your team attached. This device remembers you. The commissioner gets admin
            automatically.
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

      <div className="panel stack">
        <h2 style={{ margin: 0 }}>Get my leagues</h2>
        <DiscoverLeague />
      </div>

      <ContinueOnDevice />

      <details className="panel">
        <summary style={{ cursor: "pointer" }}>
          <strong>Have an invite or admin code instead?</strong>
        </summary>
        <div style={{ marginTop: "1rem" }}>
          <EnterCodeForm />
        </div>
      </details>
    </section>
  );
}
