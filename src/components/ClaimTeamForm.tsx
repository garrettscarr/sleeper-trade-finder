"use client";

import { useRouter } from "next/navigation";
import { FormEvent, useState } from "react";
import { setDeviceProof, setSavedUsername } from "@/lib/device-storage";

type TeamOption = { id: string; label: string; claimed: boolean };

export function ClaimTeamForm({
  leagueId,
  teams,
}: {
  leagueId: string;
  teams: TeamOption[];
}) {
  const router = useRouter();
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);

  async function reconnect(e: FormEvent<HTMLFormElement>) {
    e.preventDefault();
    setLoading(true);
    setError("");
    const form = new FormData(e.currentTarget);
    const res = await fetch(`/api/leagues/${leagueId}/claim`, {
      method: "PUT",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        sleeperUsername: String(form.get("sleeperUsername") || "").trim(),
      }),
    });
    const data = await res.json();
    setLoading(false);
    if (!res.ok) {
      setError(data.error || "Could not reconnect");
      return;
    }
    if (data.deviceProof) setDeviceProof(data.deviceProof);
    const name = String(form.get("sleeperUsername") || "").trim();
    if (name) setSavedUsername(name);
    router.refresh();
    router.push(`/leagues/${leagueId}/values`);
  }

  async function onSubmit(e: FormEvent<HTMLFormElement>) {
    e.preventDefault();
    setLoading(true);
    setError("");
    const form = new FormData(e.currentTarget);
    const res = await fetch(`/api/leagues/${leagueId}/claim`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        teamId: String(form.get("teamId")),
        label: String(form.get("label") || ""),
        sleeperUsername: String(form.get("claimUsername") || "").trim() || undefined,
      }),
    });
    const data = await res.json();
    setLoading(false);
    if (!res.ok) {
      setError(data.error || "Claim failed");
      return;
    }
    if (data.deviceProof) setDeviceProof(data.deviceProof);
    const name = String(form.get("claimUsername") || "").trim();
    if (name) setSavedUsername(name);
    router.refresh();
    router.push(`/leagues/${leagueId}/values`);
  }

  const anyClaimed = teams.some((t) => t.claimed);

  return (
    <div className="stack">
      {anyClaimed ? (
        <form className="stack" onSubmit={reconnect}>
          <p className="muted" style={{ margin: 0 }}>
            Already claimed your team on another device? Reconnect with your Sleeper
            username.
          </p>
          <div>
            <label className="label" htmlFor="sleeperUsername">
              Sleeper username
            </label>
            <input
              className="input"
              id="sleeperUsername"
              name="sleeperUsername"
              placeholder="your_sleeper_name"
              required
            />
          </div>
          <button className="btn" type="submit" disabled={loading}>
            {loading ? "Reconnecting…" : "Reconnect my team"}
          </button>
        </form>
      ) : null}

      <form className="stack" onSubmit={onSubmit}>
        <div>
          <label className="label" htmlFor="teamId">
            Your Sleeper team
          </label>
          <select className="input" id="teamId" name="teamId" required defaultValue="">
            <option value="" disabled>
              Select your team
            </option>
            {teams.map((t) => (
              <option key={t.id} value={t.id}>
                {t.label}
                {t.claimed ? " (claimed — use username to reconnect)" : ""}
              </option>
            ))}
          </select>
        </div>
        <div>
          <label className="label" htmlFor="claimUsername">
            Sleeper username (required if team shows claimed)
          </label>
          <input
            className="input"
            id="claimUsername"
            name="claimUsername"
            placeholder="your_sleeper_name"
          />
        </div>
        <div>
          <label className="label" htmlFor="label">
            Nickname (optional)
          </label>
          <input className="input" id="label" name="label" placeholder="How you want to appear" />
        </div>
        {error ? <p className="error">{error}</p> : null}
        <button className="btn" type="submit" disabled={loading}>
          {loading ? "Claiming…" : "Claim team"}
        </button>
      </form>
    </div>
  );
}
