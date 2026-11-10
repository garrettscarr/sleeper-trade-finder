"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { FormEvent, useState } from "react";
import { setDeviceProof, setSavedUsername } from "@/lib/device-storage";

type LeagueItem = {
  sleeperLeagueId: string;
  name: string;
  totalRosters: number;
  status: "waiting" | "working" | "done" | "error";
  leagueId?: string;
  created?: boolean;
  role?: string;
  teamName?: string | null;
  error?: string;
};

export function DiscoverLeague() {
  const router = useRouter();
  const [items, setItems] = useState<LeagueItem[]>([]);
  const [error, setError] = useState("");
  const [busy, setBusy] = useState(false);
  const [season, setSeason] = useState("");

  function patch(id: string, update: Partial<LeagueItem>) {
    setItems((list) =>
      list.map((it) => (it.sleeperLeagueId === id ? { ...it, ...update } : it)),
    );
  }

  async function onSubmit(e: FormEvent<HTMLFormElement>) {
    e.preventDefault();
    const username = String(new FormData(e.currentTarget).get("username") || "").trim();
    if (!username) return;
    setBusy(true);
    setError("");
    setItems([]);

    const res = await fetch("/api/sleeper/leagues", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ username }),
    });
    const data = await res.json();
    if (!res.ok) {
      setBusy(false);
      setError(data.error || "Lookup failed");
      return;
    }
    setSavedUsername(username);
    setSeason(data.season);
    const found: LeagueItem[] = (data.leagues || []).map(
      (l: { sleeperLeagueId: string; name: string; totalRosters: number }) => ({
        ...l,
        status: "waiting" as const,
      }),
    );
    setItems(found);
    if (found.length === 0) {
      setBusy(false);
      setError(`No NFL leagues found for ${username} in ${data.season}.`);
      return;
    }

    // One at a time: each response updates the session cookie the next request builds on.
    for (const item of found) {
      patch(item.sleeperLeagueId, { status: "working" });
      try {
        const r = await fetch("/api/leagues/connect", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ sleeperLeagueId: item.sleeperLeagueId, sleeperUsername: username }),
        });
        const d = await r.json();
        if (!r.ok) {
          patch(item.sleeperLeagueId, { status: "error", error: d.error || "Failed" });
          continue;
        }
        if (d.deviceProof) setDeviceProof(d.deviceProof);
        patch(item.sleeperLeagueId, {
          status: "done",
          leagueId: d.league.id,
          created: d.created,
          role: d.role,
          teamName: d.teamName,
        });
      } catch {
        patch(item.sleeperLeagueId, { status: "error", error: "Network error" });
      }
    }
    setBusy(false);
    router.refresh();
  }

  return (
    <div className="stack">
      <form className="stack" onSubmit={onSubmit}>
        <div>
          <label className="label" htmlFor="username">
            Sleeper username
          </label>
          <input
            className="input"
            id="username"
            name="username"
            placeholder="your_sleeper_name"
            autoCapitalize="none"
            autoCorrect="off"
            required
          />
        </div>
        <p className="muted" style={{ margin: 0, fontSize: "0.9rem" }}>
          Uses Sleeper&apos;s public data only, never your password. Every league you&apos;re in
          {season ? ` for ${season}` : ""} gets set up, and you&apos;re attached to your own team.
        </p>
        <button className="btn" disabled={busy} type="submit">
          {busy ? "Setting up your leagues…" : "Get my leagues"}
        </button>
      </form>

      {items.length > 0 ? (
        <div className="stack">
          {items.map((it) => (
            <div className="proposal" key={it.sleeperLeagueId}>
              <div
                style={{
                  display: "flex",
                  justifyContent: "space-between",
                  alignItems: "center",
                  gap: "0.75rem",
                  flexWrap: "wrap",
                }}
              >
                <div>
                  <strong>{it.name}</strong>
                  <div className="muted" style={{ fontSize: "0.85rem" }}>
                    {it.status === "waiting" ? "Waiting…" : null}
                    {it.status === "working" ? "Setting up…" : null}
                    {it.status === "error" ? <span className="error">{it.error}</span> : null}
                    {it.status === "done" ? (
                      <>
                        {it.created ? "New league set up" : "Joined"}
                        {it.role === "admin" ? " · commissioner" : ""}
                        {" · "}
                        {it.teamName
                          ? `your team: ${it.teamName}`
                          : "no roster found for you, tap your team inside"}
                      </>
                    ) : null}
                  </div>
                </div>
                {it.status === "done" && it.leagueId ? (
                  <Link className="btn" href={`/leagues/${it.leagueId}`}>
                    Open
                  </Link>
                ) : null}
              </div>
            </div>
          ))}
        </div>
      ) : null}

      {error ? <p className="error">{error}</p> : null}
    </div>
  );
}
