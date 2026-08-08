"use client";

import { useRouter } from "next/navigation";
import { FormEvent, useState } from "react";

type SleeperLeagueOption = {
  sleeperLeagueId: string;
  name: string;
  season: string;
  totalRosters: number;
};

export function DiscoverLeague() {
  const router = useRouter();
  const [tab, setTab] = useState<"username" | "leagueId">("username");
  const [error, setError] = useState("");
  const [status, setStatus] = useState("");
  const [loading, setLoading] = useState(false);
  const [leagues, setLeagues] = useState<SleeperLeagueOption[]>([]);
  const [season, setSeason] = useState("");
  const [createdCodes, setCreatedCodes] = useState<{
    inviteCode: string;
    adminCode: string;
    leagueId: string;
    name: string;
  } | null>(null);

  async function lookupUsername(e: FormEvent<HTMLFormElement>) {
    e.preventDefault();
    setLoading(true);
    setError("");
    setStatus("");
    setLeagues([]);
    setCreatedCodes(null);
    const form = new FormData(e.currentTarget);
    const res = await fetch("/api/sleeper/leagues", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ username: String(form.get("username")) }),
    });
    const data = await res.json();
    setLoading(false);
    if (!res.ok) {
      setError(data.error || "Lookup failed");
      return;
    }
    setSeason(data.season);
    setLeagues(data.leagues || []);
    if (!data.leagues?.length) {
      setStatus(`No NFL leagues found for ${data.user?.username} in ${data.season}.`);
    }
  }

  async function importLeague(sleeperLeagueId: string) {
    setLoading(true);
    setError("");
    setStatus("");
    setCreatedCodes(null);
    const res = await fetch("/api/leagues", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ sleeperLeagueId }),
    });
    const data = await res.json();
    setLoading(false);
    if (!res.ok) {
      setError(data.error || "Import failed");
      return;
    }
    if (data.alreadyExists) {
      setStatus(data.message);
      return;
    }
    setCreatedCodes({
      inviteCode: data.league.inviteCode,
      adminCode: data.league.adminCode,
      leagueId: data.league.id,
      name: data.league.name,
    });
  }

  async function importById(e: FormEvent<HTMLFormElement>) {
    e.preventDefault();
    const form = new FormData(e.currentTarget);
    await importLeague(String(form.get("sleeperLeagueId")).trim());
  }

  return (
    <div className="stack">
      <div className="tabs">
        <button
          type="button"
          className={`tab ${tab === "username" ? "active" : ""}`}
          onClick={() => setTab("username")}
        >
          Sleeper username
        </button>
        <button
          type="button"
          className={`tab ${tab === "leagueId" ? "active" : ""}`}
          onClick={() => setTab("leagueId")}
        >
          League ID
        </button>
      </div>

      {tab === "username" ? (
        <form className="stack" onSubmit={lookupUsername}>
          <div>
            <label className="label" htmlFor="username">
              Sleeper username
            </label>
            <input
              className="input"
              id="username"
              name="username"
              placeholder="your_sleeper_name"
              required
            />
          </div>
          <p className="muted" style={{ margin: 0, fontSize: "0.9rem" }}>
            Uses Sleeper&apos;s public API only — never asks for your Sleeper password.
            Lists leagues for the current NFL season{season ? ` (${season})` : ""}.
          </p>
          <button className="btn" disabled={loading} type="submit">
            {loading ? "Looking up…" : "Find my leagues"}
          </button>
        </form>
      ) : (
        <form className="stack" onSubmit={importById}>
          <div>
            <label className="label" htmlFor="sleeperLeagueId">
              Sleeper league ID
            </label>
            <input
              className="input"
              id="sleeperLeagueId"
              name="sleeperLeagueId"
              placeholder="e.g. 112345678901234567"
              required
            />
          </div>
          <button className="btn" disabled={loading} type="submit">
            {loading ? "Importing…" : "Import league"}
          </button>
        </form>
      )}

      {leagues.length > 0 ? (
        <div className="stack">
          <h3 style={{ margin: 0 }}>Select a league to set up</h3>
          {leagues.map((l) => (
            <button
              key={l.sleeperLeagueId}
              type="button"
              className="panel"
              style={{ textAlign: "left", cursor: "pointer", width: "100%" }}
              disabled={loading}
              onClick={() => importLeague(l.sleeperLeagueId)}
            >
              <strong>{l.name}</strong>
              <div className="muted">
                {l.totalRosters} teams · season {l.season} · ID {l.sleeperLeagueId}
              </div>
            </button>
          ))}
        </div>
      ) : null}

      {createdCodes ? (
        <div className="panel stack">
          <h3 style={{ margin: 0 }}>League ready: {createdCodes.name}</h3>
          <p className="success" style={{ margin: 0 }}>
            Save these codes — they are the only way into this league (no passwords).
          </p>
          <div>
            <div className="label">Invite code (share with managers)</div>
            <code style={{ fontSize: "1.1rem" }}>{createdCodes.inviteCode}</code>
          </div>
          <div>
            <div className="label">Admin code (commissioner only — keep private)</div>
            <code style={{ fontSize: "1.1rem" }}>{createdCodes.adminCode}</code>
          </div>
          <button
            className="btn"
            type="button"
            onClick={() => {
              router.push(`/leagues/${createdCodes.leagueId}`);
              router.refresh();
            }}
          >
            Open league
          </button>
        </div>
      ) : null}

      {error ? <p className="error">{error}</p> : null}
      {status ? <p className="muted">{status}</p> : null}
    </div>
  );
}
