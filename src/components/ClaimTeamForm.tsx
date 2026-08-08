"use client";

import { useRouter } from "next/navigation";
import { FormEvent, useState } from "react";

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
      }),
    });
    const data = await res.json();
    setLoading(false);
    if (!res.ok) {
      setError(data.error || "Claim failed");
      return;
    }
    router.refresh();
    router.push(`/leagues/${leagueId}/values`);
  }

  return (
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
            <option key={t.id} value={t.id} disabled={t.claimed}>
              {t.label}
              {t.claimed ? " (claimed)" : ""}
            </option>
          ))}
        </select>
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
  );
}
