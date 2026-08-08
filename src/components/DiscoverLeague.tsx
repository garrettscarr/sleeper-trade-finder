"use client";

import { useRouter } from "next/navigation";
import { FormEvent, useEffect, useState } from "react";

type SleeperLeagueOption = {
  sleeperLeagueId: string;
  name: string;
  season: string;
  totalRosters: number;
};

type CodesPanel = {
  inviteCode: string;
  adminCode: string;
  leagueId: string;
  name: string;
  recovered?: boolean;
};

const CODES_KEY = "stf_league_codes";

function saveCodesLocally(codes: CodesPanel) {
  try {
    const prev = JSON.parse(localStorage.getItem(CODES_KEY) || "[]") as CodesPanel[];
    const next = [codes, ...prev.filter((c) => c.leagueId !== codes.leagueId)].slice(0, 8);
    localStorage.setItem(CODES_KEY, JSON.stringify(next));
  } catch {
    // ignore storage failures
  }
}

export function DiscoverLeague() {
  const router = useRouter();
  const [tab, setTab] = useState<"username" | "leagueId">("username");
  const [error, setError] = useState("");
  const [status, setStatus] = useState("");
  const [loading, setLoading] = useState(false);
  const [leagues, setLeagues] = useState<SleeperLeagueOption[]>([]);
  const [season, setSeason] = useState("");
  const [username, setUsername] = useState("");
  const [createdCodes, setCreatedCodes] = useState<CodesPanel | null>(null);
  const [savedCodes, setSavedCodes] = useState<CodesPanel[]>([]);

  useEffect(() => {
    try {
      const raw = localStorage.getItem(CODES_KEY);
      if (raw) setSavedCodes(JSON.parse(raw) as CodesPanel[]);
    } catch {
      // ignore
    }
  }, []);

  async function lookupUsername(e: FormEvent<HTMLFormElement>) {
    e.preventDefault();
    setLoading(true);
    setError("");
    setStatus("");
    setLeagues([]);
    setCreatedCodes(null);
    const form = new FormData(e.currentTarget);
    const name = String(form.get("username")).trim();
    setUsername(name);
    const res = await fetch("/api/sleeper/leagues", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ username: name }),
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

  async function importLeague(sleeperLeagueId: string, sleeperUsername?: string) {
    setLoading(true);
    setError("");
    setStatus("");
    setCreatedCodes(null);
    const res = await fetch("/api/leagues", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        sleeperLeagueId,
        sleeperUsername: sleeperUsername || undefined,
      }),
    });
    const data = await res.json();
    setLoading(false);
    if (!res.ok) {
      setError(data.error || "Import failed");
      return;
    }

    if (data.league?.inviteCode && data.league?.adminCode) {
      const panel: CodesPanel = {
        inviteCode: data.league.inviteCode,
        adminCode: data.league.adminCode,
        leagueId: data.league.id,
        name: data.league.name,
        recovered: Boolean(data.recovered),
      };
      setCreatedCodes(panel);
      saveCodesLocally(panel);
      setSavedCodes((prev) => [panel, ...prev.filter((c) => c.leagueId !== panel.leagueId)]);
      setStatus(data.message || "");
      return;
    }

    if (data.alreadyExists) {
      setStatus(
        data.message ||
          "League already set up. Use Find my leagues with your Sleeper username to unlock, or enter a code on Join.",
      );
      return;
    }
  }

  async function importById(e: FormEvent<HTMLFormElement>) {
    e.preventDefault();
    const form = new FormData(e.currentTarget);
    const id = String(form.get("sleeperLeagueId")).trim();
    const name = String(form.get("sleeperUsername") || "").trim() || username;
    await importLeague(id, name || undefined);
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
            Lists leagues for the current NFL season{season ? ` (${season})` : ""}. If the
            league is already set up, selecting it unlocks this browser and shows your codes
            again.
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
          <div>
            <label className="label" htmlFor="sleeperUsername">
              Your Sleeper username (needed to unlock if already set up)
            </label>
            <input
              className="input"
              id="sleeperUsername"
              name="sleeperUsername"
              placeholder="your_sleeper_name"
              defaultValue={username}
            />
          </div>
          <button className="btn" disabled={loading} type="submit">
            {loading ? "Importing…" : "Import / unlock league"}
          </button>
        </form>
      )}

      {leagues.length > 0 ? (
        <div className="stack">
          <h3 style={{ margin: 0 }}>Select a league to set up or unlock</h3>
          {leagues.map((l) => (
            <button
              key={l.sleeperLeagueId}
              type="button"
              className="panel"
              style={{ textAlign: "left", cursor: "pointer", width: "100%" }}
              disabled={loading}
              onClick={() => importLeague(l.sleeperLeagueId, username)}
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
          <h3 style={{ margin: 0 }}>
            {createdCodes.recovered ? "Unlocked" : "League ready"}: {createdCodes.name}
          </h3>
          <p className="success" style={{ margin: 0 }}>
            Save these codes — screenshot or copy them. They unlock the league on any phone
            (no passwords). Also saved in this browser.
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

      {savedCodes.length > 0 && !createdCodes ? (
        <div className="panel stack">
          <h3 style={{ margin: 0 }}>Codes saved on this device</h3>
          <p className="muted" style={{ margin: 0 }}>
            Use Join with a code below if your session was cleared.
          </p>
          {savedCodes.map((c) => (
            <div key={c.leagueId}>
              <strong>{c.name}</strong>
              <div className="muted" style={{ fontSize: "0.9rem" }}>
                Invite <code>{c.inviteCode}</code> · Admin <code>{c.adminCode}</code>
              </div>
            </div>
          ))}
        </div>
      ) : null}

      {error ? <p className="error">{error}</p> : null}
      {status ? <p className="muted">{status}</p> : null}
    </div>
  );
}
