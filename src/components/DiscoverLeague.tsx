"use client";

import { useRouter } from "next/navigation";
import { FormEvent, useEffect, useState } from "react";
import {
  getDeviceProof,
  getSavedCodes,
  saveLeagueCodes,
  setDeviceProof,
  setSavedUsername,
  type SavedLeagueCodes,
} from "@/lib/device-storage";

type SleeperLeagueOption = {
  sleeperLeagueId: string;
  name: string;
  season: string;
  totalRosters: number;
};

type CodesPanel = SavedLeagueCodes & { recovered?: boolean };

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
  const [savedCodes, setSavedCodes] = useState<SavedLeagueCodes[]>([]);
  const [pendingLeagueId, setPendingLeagueId] = useState<string | null>(null);
  const [accessCode, setAccessCode] = useState("");

  useEffect(() => {
    setSavedCodes(getSavedCodes());
  }, []);

  async function lookupUsername(e: FormEvent<HTMLFormElement>) {
    e.preventDefault();
    setLoading(true);
    setError("");
    setStatus("");
    setLeagues([]);
    setCreatedCodes(null);
    setPendingLeagueId(null);
    const form = new FormData(e.currentTarget);
    const name = String(form.get("username")).trim();
    setUsername(name);
    setSavedUsername(name);
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

  async function importLeague(
    sleeperLeagueId: string,
    sleeperUsername?: string,
    code?: string,
  ) {
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
        accessCode: code || undefined,
        deviceProof: getDeviceProof() || undefined,
      }),
    });
    const data = await res.json();
    setLoading(false);
    if (!res.ok) {
      setError(data.error || "Import failed");
      return;
    }

    if (data.deviceProof) setDeviceProof(data.deviceProof);

    if (data.needsCode) {
      setPendingLeagueId(sleeperLeagueId);
      setStatus(data.message);
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
      saveLeagueCodes(panel);
      setSavedCodes(getSavedCodes());
      setPendingLeagueId(null);
      setStatus(data.message || "This device will remember your admin access.");
      return;
    }

    if (data.recovered && data.league?.id) {
      setPendingLeagueId(null);
      setStatus(data.message || "Unlocked on this device.");
      router.push(`/leagues/${data.league.id}`);
      router.refresh();
      return;
    }

    if (data.alreadyExists) {
      setStatus(data.message || "League already set up.");
    }
  }

  async function importById(e: FormEvent<HTMLFormElement>) {
    e.preventDefault();
    const form = new FormData(e.currentTarget);
    const id = String(form.get("sleeperLeagueId")).trim();
    const name = String(form.get("sleeperUsername") || "").trim() || username;
    const code = String(form.get("accessCode") || "").trim();
    await importLeague(id, name || undefined, code || undefined);
  }

  async function submitPendingCode(e: FormEvent<HTMLFormElement>) {
    e.preventDefault();
    if (!pendingLeagueId) return;
    await importLeague(pendingLeagueId, username || undefined, accessCode.trim());
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
            Public Sleeper lookup only. First import unlocks you as commissioner on this
            device. If the league already exists, you&apos;ll enter the admin/invite code
            once (unless this phone already remembers you).
            {season ? ` Season ${season}.` : ""}
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
              Your Sleeper username
            </label>
            <input
              className="input"
              id="sleeperUsername"
              name="sleeperUsername"
              placeholder="your_sleeper_name"
              defaultValue={username}
            />
          </div>
          <div>
            <label className="label" htmlFor="accessCode">
              Invite/admin code (only if already set up)
            </label>
            <input
              className="input"
              id="accessCode"
              name="accessCode"
              placeholder="abcd-efgh"
            />
          </div>
          <button className="btn" disabled={loading} type="submit">
            {loading ? "Working…" : "Import / unlock league"}
          </button>
        </form>
      )}

      {leagues.length > 0 ? (
        <div className="stack">
          <h3 style={{ margin: 0 }}>Select a league</h3>
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

      {pendingLeagueId ? (
        <form className="panel stack" onSubmit={submitPendingCode}>
          <h3 style={{ margin: 0 }}>Enter code once</h3>
          <p className="muted" style={{ margin: 0 }}>
            This league is already set up. Paste the invite or admin code — then this
            device remembers you (no account).
          </p>
          <input
            className="input"
            value={accessCode}
            onChange={(e) => setAccessCode(e.target.value)}
            placeholder="abcd-efgh"
            required
          />
          <button className="btn" disabled={loading} type="submit">
            {loading ? "Unlocking…" : "Unlock on this device"}
          </button>
        </form>
      ) : null}

      {createdCodes ? (
        <div className="panel stack">
          <h3 style={{ margin: 0 }}>
            {createdCodes.recovered ? "Unlocked" : "League ready"}: {createdCodes.name}
          </h3>
          <p className="success" style={{ margin: 0 }}>
            Screenshot these. Share the invite link with managers. This phone is now
            remembered as admin — you shouldn&apos;t need the admin code every visit.
          </p>
          <div>
            <div className="label">Invite code (share)</div>
            <code style={{ fontSize: "1.1rem" }}>{createdCodes.inviteCode}</code>
          </div>
          <div>
            <div className="label">Invite link</div>
            <code style={{ fontSize: "0.95rem", wordBreak: "break-all" }}>
              /join/{createdCodes.inviteCode}
            </code>
          </div>
          <div>
            <div className="label">Admin code (private)</div>
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
          <h3 style={{ margin: 0 }}>Codes on this device</h3>
          {savedCodes.map((c) => (
            <div key={c.leagueId}>
              <strong>{c.name}</strong>
              <div className="muted" style={{ fontSize: "0.9rem" }}>
                Invite <code>{c.inviteCode}</code>
                {c.adminCode ? (
                  <>
                    {" "}
                    · Admin <code>{c.adminCode}</code>
                  </>
                ) : null}
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
