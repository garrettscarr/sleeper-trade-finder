"use client";

import { useMemo, useState } from "react";
import { PlayerPhoto } from "@/components/PlayerPhoto";
import { clampStars, formatStars, nudgeStars } from "@/lib/stars";

export type ValueRow = {
  kind: "player" | "pick";
  id: string;
  sleeperPlayerId?: string;
  sleeperAvatarId?: string | null;
  label: string;
  position?: string | null;
  nflTeam?: string | null;
  value: number;
  market: number | null;
  league: number | null;
  leagueRaters: number;
  tier: string | null;
  onRoster: boolean;
};

function StarBar({ value }: { value: number }) {
  const v = clampStars(value);
  return (
    <span aria-label={formatStars(v)} title={formatStars(v)} style={{ letterSpacing: "0.05em" }}>
      {Array.from({ length: 5 }, (_, i) => {
        const threshold = i + 1;
        if (v >= threshold) return <span key={i}>★</span>;
        if (v >= threshold - 0.5) return <span key={i} style={{ opacity: 0.55 }}>⯨</span>;
        return (
          <span key={i} style={{ opacity: 0.25 }}>
            ☆
          </span>
        );
      })}
    </span>
  );
}

function vsLeagueLabel(yours: number, league: number | null) {
  if (league == null) return "no league ratings yet";
  const d = clampStars(yours) - clampStars(league);
  if (Math.abs(d) < 0.25) return "in line with league";
  if (d > 0) return `+${d.toFixed(1)}★ vs league`;
  return `${d.toFixed(1)}★ vs league`;
}

export function ValuesEditor({
  leagueId,
  initialRoster,
  initialLeagueAssets,
  claimedManagers = 0,
}: {
  leagueId: string;
  initialRoster: ValueRow[];
  initialLeagueAssets: ValueRow[];
  claimedManagers?: number;
}) {
  const [tab, setTab] = useState<"roster" | "league">("roster");
  const [rows, setRows] = useState<ValueRow[]>(initialRoster);
  const [leagueRows, setLeagueRows] = useState<ValueRow[]>(initialLeagueAssets);
  const [pending, setPending] = useState<Record<string, ValueRow>>({});
  const [status, setStatus] = useState("");
  const [saving, setSaving] = useState(false);

  const visible = tab === "roster" ? rows : leagueRows;
  const dirtyCount = Object.keys(pending).length;

  function keyOf(r: ValueRow) {
    return `${r.kind}:${r.id}`;
  }

  function updateRow(row: ValueRow, patch: Partial<ValueRow>) {
    const next = { ...row, ...patch, value: clampStars(patch.value ?? row.value) };
    const key = keyOf(next);
    setPending((p) => ({ ...p, [key]: next }));
    const setter = tab === "roster" ? setRows : setLeagueRows;
    setter((list) => list.map((r) => (keyOf(r) === key ? next : r)));
  }

  function applyPayload(data: {
    roster?: ValueRow[];
    leagueAssets?: ValueRow[];
  }) {
    if (data.roster) setRows(data.roster);
    if (data.leagueAssets) setLeagueRows(data.leagueAssets);
  }

  async function save() {
    setSaving(true);
    setStatus("");
    const updates = Object.values(pending).map((r) => ({
      kind: r.kind,
      id: r.id,
      value: clampStars(r.value),
      tier: (r.tier as "love" | "fair" | "fade") || "fair",
    }));
    const res = await fetch(`/api/leagues/${leagueId}/values`, {
      method: "PUT",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ updates }),
    });
    const data = await res.json();
    setSaving(false);
    if (!res.ok) {
      setStatus(data.error || "Save failed");
      return;
    }
    setPending({});
    applyPayload(data);
    setStatus(`Saved ${updates.length} ratings — league consensus updated`);
  }

  const progress = useMemo(() => {
    const rated = rows.filter((r) => r.value > 0 || r.market != null).length;
    return rows.length === 0 ? 0 : Math.round((rated / rows.length) * 100);
  }, [rows]);

  return (
    <div className="stack">
      <div style={{ display: "flex", justifyContent: "space-between", gap: "1rem", flexWrap: "wrap" }}>
        <p className="muted" style={{ margin: 0 }}>
          Your ★ vs live <strong>League ★</strong> (median of {claimedManagers || "claimed"}{" "}
          managers). Market ★ is the system baseline (ADP/projections). Roster coverage ~
          {progress}%.
        </p>
        <button className="btn" disabled={!dirtyCount || saving} onClick={save}>
          {saving ? "Saving…" : `Save${dirtyCount ? ` (${dirtyCount})` : ""}`}
        </button>
      </div>
      {status ? <p className={status.includes("Saved") ? "success" : "error"}>{status}</p> : null}

      <div className="tabs">
        <button
          type="button"
          className={`tab ${tab === "roster" ? "active" : ""}`}
          onClick={() => setTab("roster")}
        >
          My roster
        </button>
        <button
          type="button"
          className={`tab ${tab === "league" ? "active" : ""}`}
          onClick={() => setTab("league")}
        >
          League assets
        </button>
      </div>

      <div className="panel" style={{ overflowX: "auto" }}>
        <table className="table">
          <thead>
            <tr>
              <th>Asset</th>
              <th>Pos</th>
              <th>Your ★</th>
              <th>League ★</th>
              <th>Market ★</th>
              <th>You vs league</th>
              <th>Tier</th>
            </tr>
          </thead>
          <tbody>
            {visible.map((row) => (
              <tr key={keyOf(row)}>
                <td>
                  <div style={{ display: "flex", alignItems: "center", gap: "0.65rem" }}>
                    <PlayerPhoto
                      sleeperPlayerId={row.kind === "player" ? row.sleeperPlayerId : null}
                      sleeperAvatarId={row.kind === "pick" ? row.sleeperAvatarId : null}
                      name={row.label}
                      size={42}
                    />
                    <div>
                      <strong>{row.label}</strong>
                      {row.nflTeam ? <div className="muted">{row.nflTeam}</div> : null}
                    </div>
                  </div>
                </td>
                <td>{row.position || "—"}</td>
                <td>
                  <div style={{ display: "flex", alignItems: "center", gap: "0.5rem" }}>
                    <div className="nudge">
                      <button
                        type="button"
                        onClick={() => updateRow(row, { value: nudgeStars(row.value, -1) })}
                      >
                        −
                      </button>
                      <button
                        type="button"
                        onClick={() => updateRow(row, { value: nudgeStars(row.value, 1) })}
                      >
                        +
                      </button>
                    </div>
                    <StarBar value={row.value} />
                    <strong>{formatStars(row.value)}</strong>
                  </div>
                </td>
                <td>
                  {row.league == null ? (
                    <span className="muted">—</span>
                  ) : (
                    <div>
                      <StarBar value={row.league} />{" "}
                      <strong>{formatStars(row.league)}</strong>
                      <div className="muted" style={{ fontSize: "0.75rem" }}>
                        {row.leagueRaters} rater{row.leagueRaters === 1 ? "" : "s"}
                      </div>
                    </div>
                  )}
                </td>
                <td>
                  {row.market == null ? (
                    <span className="muted">—</span>
                  ) : (
                    <>
                      <StarBar value={row.market} />{" "}
                      <span className="muted">{formatStars(row.market)}</span>
                    </>
                  )}
                </td>
                <td className="muted">{vsLeagueLabel(row.value, row.league)}</td>
                <td>
                  <select
                    className="input"
                    style={{ width: 110 }}
                    value={row.tier || "fair"}
                    onChange={(e) => updateRow(row, { tier: e.target.value })}
                  >
                    <option value="love">love</option>
                    <option value="fair">fair</option>
                    <option value="fade">fade</option>
                  </select>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}
