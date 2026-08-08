"use client";

import { useRouter } from "next/navigation";
import { FormEvent, useState } from "react";
import { CopyAdminLink, CopyInviteLink } from "@/components/CopyInviteLink";

export function AdminPanel({
  leagueId,
  scoringType,
  baselineSource,
  inviteCode,
  adminCode,
}: {
  leagueId: string;
  scoringType: string;
  baselineSource: string | null;
  inviteCode: string;
  adminCode: string;
}) {
  const router = useRouter();
  const [status, setStatus] = useState("");
  const [error, setError] = useState("");
  const [busy, setBusy] = useState(false);

  async function sync() {
    setBusy(true);
    setError("");
    setStatus("");
    const res = await fetch(`/api/leagues/${leagueId}/sync`, { method: "POST" });
    const data = await res.json();
    setBusy(false);
    if (!res.ok) {
      setError(data.error || "Sync failed");
      return;
    }
    setStatus(
      data.baseline
        ? `Synced + recomputed stars (${data.baseline.updated} players, ${data.baseline.adpField})`
        : "Synced from Sleeper",
    );
    router.refresh();
  }

  async function recomputeBaseline() {
    setBusy(true);
    setError("");
    setStatus("");
    const res = await fetch(`/api/leagues/${leagueId}/baseline`, { method: "POST" });
    const data = await res.json();
    setBusy(false);
    if (!res.ok) {
      setError(data.error || "Baseline recompute failed");
      return;
    }
    const labels = data.context?.labels?.join(", ") || "";
    setStatus(
      `Market ★ updated for ${data.updated} players (${data.adpField} + ${data.ptsField}${labels ? `; ${labels}` : ""}). Your personal ratings were kept.`,
    );
    router.refresh();
  }

  async function saveSettings(e: FormEvent<HTMLFormElement>) {
    e.preventDefault();
    setBusy(true);
    setError("");
    const form = new FormData(e.currentTarget);
    const res = await fetch(`/api/leagues/${leagueId}/settings`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ scoringType: form.get("scoringType") }),
    });
    const data = await res.json();
    setBusy(false);
    if (!res.ok) {
      setError(data.error || "Failed to save settings");
      return;
    }
    setStatus("Settings saved — recompute baselines to apply SF/1QB ADP choice");
    router.refresh();
  }

  return (
    <div className="stack">
      <div className="panel stack">
        <h2 style={{ margin: 0 }}>Sleeper sync</h2>
        <p className="muted" style={{ margin: 0 }}>
          Refresh rosters/picks, then recompute market ★ from ADP + projections +
          actuals.
        </p>
        <button className="btn btn-secondary" disabled={busy} onClick={sync} type="button">
          Refresh from Sleeper
        </button>
      </div>

      <div className="panel stack">
        <h2 style={{ margin: 0 }}>Star baselines (2K-style)</h2>
        <p className="muted" style={{ margin: 0 }}>
          Each asset gets 0–5★ (half-star steps). Baseline blends format{" "}
          <strong>ADP</strong> + <strong>projected points</strong> (actuals weigh more in-season),
          then adjusts for <strong>TE premium</strong>, <strong>age</strong>, and{" "}
          <strong>positional scarcity</strong> from your Sleeper league settings — KTC-style
          factors without scraping KTC.
        </p>
        <p className="muted" style={{ margin: 0, fontSize: "0.85rem" }}>
          Current source: {baselineSource || "not computed yet"}
        </p>
        <p className="muted" style={{ margin: 0, fontSize: "0.85rem" }}>
          Recompute updates Market ★ only. Saved personal ratings stay put; new players/picks
          get seeded from market.
        </p>
        <button className="btn" disabled={busy} onClick={recomputeBaseline} type="button">
          Recompute market baselines
        </button>
      </div>

      <div className="panel stack">
        <h2 style={{ margin: 0 }}>League settings</h2>
        <form className="stack" onSubmit={saveSettings}>
          <div>
            <label className="label" htmlFor="scoringType">
              Format (selects ADP / projection lane)
            </label>
            <select
              className="input"
              id="scoringType"
              name="scoringType"
              defaultValue={scoringType}
            >
              <option value="1QB">1QB</option>
              <option value="SF">Superflex</option>
            </select>
          </div>
          <button className="btn btn-secondary" disabled={busy} type="submit">
            Save settings
          </button>
        </form>
      </div>

      <div className="panel stack">
        <h2 style={{ margin: 0 }}>Invite link (share with league)</h2>
        <CopyInviteLink inviteCode={inviteCode} />
        <p className="muted" style={{ margin: 0 }}>
          Invite code: <code>{inviteCode}</code>
        </p>
      </div>

      <div className="panel stack">
        <h2 style={{ margin: 0 }}>Admin unlock link (you only)</h2>
        <p className="muted" style={{ margin: 0 }}>
          Text this to yourself to test commissioner access on your phone. Do not put it in
          the group chat.
        </p>
        <CopyAdminLink adminCode={adminCode} />
        <p className="muted" style={{ margin: 0 }}>
          Admin code: <code>{adminCode}</code>
        </p>
      </div>

      {error ? <p className="error">{error}</p> : null}
      {status ? <p className="success">{status}</p> : null}
    </div>
  );
}
