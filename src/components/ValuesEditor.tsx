"use client";

import { useMemo, useState } from "react";
import { PlayerPhoto } from "@/components/PlayerPhoto";
import { clampStars, nudgeStars } from "@/lib/stars";

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

const POSITIONS = ["All", "QB", "RB", "WR", "TE", "PICK"] as const;
const TIERS = ["love", "fair", "fade"] as const;

const keyOf = (r: ValueRow) => `${r.kind}:${r.id}`;

function AssetRow({
  row,
  onChange,
}: {
  row: ValueRow;
  onChange: (row: ValueRow, patch: Partial<ValueRow>) => void;
}) {
  const meta = [
    row.position && row.position !== "PICK" ? row.position : null,
    row.league != null ? `Lg ${clampStars(row.league).toFixed(1)}` : null,
    row.market != null ? `Mkt ${clampStars(row.market).toFixed(1)}` : null,
  ].filter(Boolean);
  return (
    <div className="asset-row">
      <PlayerPhoto
        sleeperPlayerId={row.kind === "player" ? row.sleeperPlayerId : null}
        sleeperAvatarId={row.kind === "pick" ? row.sleeperAvatarId : null}
        name={row.label}
        size={44}
      />
      <div className="asset-main">
        <div className="asset-name">{row.label}</div>
        <div className="asset-meta">{meta.join(" · ")}</div>
        <div className="tier-chips">
          {TIERS.map((t) => (
            <button
              key={t}
              type="button"
              className={`chip chip-${t} ${(row.tier || "fair") === t ? "on" : ""}`}
              onClick={() => onChange(row, { tier: t })}
            >
              {t}
            </button>
          ))}
        </div>
      </div>
      <div className="stepper">
        <button
          type="button"
          aria-label={`Lower ${row.label}`}
          onClick={() => onChange(row, { value: nudgeStars(row.value, -1) })}
        >
          −
        </button>
        <div className="stepper-val">
          {clampStars(row.value).toFixed(1)}
          <small>★</small>
        </div>
        <button
          type="button"
          aria-label={`Raise ${row.label}`}
          onClick={() => onChange(row, { value: nudgeStars(row.value, 1) })}
        >
          +
        </button>
      </div>
    </div>
  );
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
  const [pos, setPos] = useState<(typeof POSITIONS)[number]>("All");
  const [query, setQuery] = useState("");
  const [rows, setRows] = useState<ValueRow[]>(initialRoster);
  const [leagueRows, setLeagueRows] = useState<ValueRow[]>(initialLeagueAssets);
  const [pending, setPending] = useState<Record<string, ValueRow>>({});
  const [status, setStatus] = useState("");
  const [saving, setSaving] = useState(false);

  const dirtyCount = Object.keys(pending).length;

  function updateRow(row: ValueRow, patch: Partial<ValueRow>) {
    const next = { ...row, ...patch, value: clampStars(patch.value ?? row.value) };
    const key = keyOf(next);
    setPending((p) => ({ ...p, [key]: next }));
    setStatus("");
    if (rows.some((r) => keyOf(r) === key)) {
      setRows((list) => list.map((r) => (keyOf(r) === key ? next : r)));
    } else {
      setLeagueRows((list) => list.map((r) => (keyOf(r) === key ? next : r)));
    }
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
    if (data.roster) setRows(data.roster);
    if (data.leagueAssets) setLeagueRows(data.leagueAssets);
    setStatus(`Saved ${updates.length} rating${updates.length === 1 ? "" : "s"}`);
  }

  const matches = (r: ValueRow) => {
    if (pos !== "All" && (r.position || "") !== pos) return false;
    const q = query.trim().toLowerCase();
    return !q || r.label.toLowerCase().includes(q);
  };

  const visibleRoster = useMemo(() => rows.filter(matches), [rows, pos, query]); // eslint-disable-line react-hooks/exhaustive-deps

  const groupedLeague = useMemo(() => {
    const filtered = leagueRows.filter(
      (r) => (teamFilter === "all" || r.ownerTeamId === teamFilter) && matches(r),
    );
    const groups = new Map<string, { label: string; avatar: string | null; rows: ValueRow[] }>();
    for (const row of filtered) {
      const id = row.ownerTeamId || "unknown";
      const g = groups.get(id);
      if (g) g.rows.push(row);
      else
        groups.set(id, {
          label: row.ownerTeamLabel || "Unknown team",
          avatar: row.ownerAvatar ?? null,
          rows: [row],
        });
    }
    return [...groups.entries()].sort((a, b) => a[1].label.localeCompare(b[1].label));
  }, [leagueRows, teamFilter, pos, query]); // eslint-disable-line react-hooks/exhaustive-deps

  return (
    <div className="stack">
      <p className="muted" style={{ margin: 0, fontSize: "0.9rem" }}>
        Tap − / + to rate. Lg is the median of {claimedManagers || "all"} managers&apos;
        ratings; Mkt is the market baseline.
      </p>

      <div className="seg">
        <button
          type="button"
          className={tab === "roster" ? "on" : ""}
          onClick={() => setTab("roster")}
        >
          My roster
        </button>
        <button
          type="button"
          className={tab === "league" ? "on" : ""}
          onClick={() => setTab("league")}
        >
          Other teams
        </button>
      </div>

      {tab === "league" ? (
        <select
          className="input"
          aria-label="Fantasy team"
          value={teamFilter}
          onChange={(e) => setTeamFilter(e.target.value)}
        >
          <option value="all">All other teams</option>
          {teamFilters.map((t) => (
            <option key={t.id} value={t.id}>
              {t.label}
            </option>
          ))}
        </select>
      ) : null}

      <input
        className="input"
        type="search"
        placeholder="Search players"
        value={query}
        onChange={(e) => setQuery(e.target.value)}
      />
      <div className="chip-scroll">
        {POSITIONS.map((p) => (
          <button
            key={p}
            type="button"
            className={`chip ${pos === p ? "on" : ""}`}
            onClick={() => setPos(p)}
          >
            {p === "PICK" ? "Picks" : p}
          </button>
        ))}
      </div>

      {tab === "roster" ? (
        <div className="asset-list">
          {visibleRoster.length === 0 ? <p className="muted">Nothing matches.</p> : null}
          {visibleRoster.map((r) => (
            <AssetRow key={keyOf(r)} row={r} onChange={updateRow} />
          ))}
        </div>
      ) : (
        <div className="stack">
          {groupedLeague.length === 0 ? <p className="muted">Nothing matches.</p> : null}
          {groupedLeague.map(([id, group]) => (
            <div key={id} className="stack" style={{ gap: "0.5rem" }}>
              <div className="group-head">
                <PlayerPhoto sleeperAvatarId={group.avatar} name={group.label} size={28} />
                <strong>{group.label}</strong>
                <span className="muted">{group.rows.length}</span>
              </div>
              <div className="asset-list">
                {group.rows.map((r) => (
                  <AssetRow key={keyOf(r)} row={r} onChange={updateRow} />
                ))}
              </div>
            </div>
          ))}
        </div>
      )}

      {dirtyCount > 0 || status ? (
        <div className="save-bar">
          <span className={status && !dirtyCount ? (status.startsWith("Saved") ? "success" : "error") : "muted"}>
            {dirtyCount > 0 ? `${dirtyCount} unsaved change${dirtyCount === 1 ? "" : "s"}` : status}
          </span>
          {dirtyCount > 0 ? (
            <button className="btn" type="button" disabled={saving} onClick={save}>
              {saving ? "Saving…" : "Save"}
            </button>
          ) : null}
        </div>
      ) : null}
    </div>
  );
}
