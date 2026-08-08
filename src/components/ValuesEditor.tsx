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
  ownerTeamId?: string | null;
  ownerTeamLabel?: string | null;
  ownerAvatar?: string | null;
};

export type TeamFilter = {
  id: string;
  label: string;
  avatar?: string | null;
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
  teamFilters = [],
  claimedManagers = 0,
}: {
  leagueId: string;
  initialRoster: ValueRow[];
  initialLeagueAssets: ValueRow[];
  teamFilters?: TeamFilter[];
  claimedManagers?: number;
}) {
  const [tab, setTab] = useState<"roster" | "league">("roster");
  const [teamFilter, setTeamFilter] = useState<string>("all");
  const [rows, setRows] = useState<ValueRow[]>(initialRoster);
  const [leagueRows, setLeagueRows] = useState<ValueRow[]>(initialLeagueAssets);
  const [pending, setPending] = useState<Record<string, ValueRow>>({});
  const [status, setStatus] = useState("");
  const [saving, setSaving] = useState(false);

  const dirtyCount = Object.keys(pending).length;

  function keyOf(r: ValueRow) {
    return `${r.kind}:${r.id}`;
  }

  function updateRow(row: ValueRow, patch: Partial<ValueRow>) {
    const next = { ...row, ...patch, value: clampStars(patch.value ?? row.value) };
    const key = keyOf(next);
    setPending((p) => ({ ...p, [key]: next }));
    const onRosterList = rows.some((r) => keyOf(r) === key);
    if (onRosterList) {
      setRows((list) => list.map((r) => (keyOf(r) === key ? next : r)));
    } else {
      setLeagueRows((list) => list.map((r) => (keyOf(r) === key ? next : r)));
    }
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

  const filteredLeague = useMemo(() => {
    if (teamFilter === "all") return leagueRows;
    return leagueRows.filter((r) => r.ownerTeamId === teamFilter);
  }, [leagueRows, teamFilter]);

  const groupedLeague = useMemo(() => {
    const groups = new Map<string, { label: string; avatar: string | null; rows: ValueRow[] }>();
    for (const row of filteredLeague) {
      const id = row.ownerTeamId || "unknown";
      const label = row.ownerTeamLabel || "Unknown team";
      const existing = groups.get(id);
      if (existing) existing.rows.push(row);
      else groups.set(id, { label, avatar: row.ownerAvatar ?? null, rows: [row] });
    }
    return [...groups.entries()].sort((a, b) => a[1].label.localeCompare(b[1].label));
  }, [filteredLeague]);

  function renderAssetRow(row: ValueRow) {
    return (
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
              <StarBar value={row.league} /> <strong>{formatStars(row.league)}</strong>
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
    );
  }

  const tableHead = (
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
  );

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
          By team
        </button>
      </div>

      {tab === "league" ? (
        <div>
          <label className="label" htmlFor="teamFilter">
            Fantasy team
          </label>
          <select
            className="input"
            id="teamFilter"
            value={teamFilter}
            onChange={(e) => setTeamFilter(e.target.value)}
            style={{ maxWidth: 360 }}
          >
            <option value="all">All other teams</option>
            {teamFilters.map((t) => (
              <option key={t.id} value={t.id}>
                {t.label}
              </option>
            ))}
          </select>
        </div>
      ) : null}

      {tab === "roster" ? (
        <div className="panel" style={{ overflowX: "auto" }}>
          <table className="table">
            {tableHead}
            <tbody>{rows.map(renderAssetRow)}</tbody>
          </table>
        </div>
      ) : (
        <div className="stack">
          {groupedLeague.length === 0 ? (
            <p className="muted">No assets for that team.</p>
          ) : null}
          {groupedLeague.map(([id, group]) => (
            <div className="panel stack" key={id} style={{ overflowX: "auto" }}>
              <div style={{ display: "flex", alignItems: "center", gap: "0.65rem" }}>
                <PlayerPhoto
                  sleeperAvatarId={group.avatar}
                  name={group.label}
                  size={36}
                />
                <h3 style={{ margin: 0 }}>{group.label}</h3>
                <span className="muted">{group.rows.length} assets</span>
              </div>
              <table className="table">
                {tableHead}
                <tbody>{group.rows.map(renderAssetRow)}</tbody>
              </table>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
