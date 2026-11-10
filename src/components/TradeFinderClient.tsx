"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import { PlayerPhoto } from "@/components/PlayerPhoto";
import { PositionBadge } from "@/components/PositionBadge";

type PartnerPayload = {
  team: {
    id: string;
    displayName: string;
    teamName: string | null;
    claimed: boolean;
  };
  players: {
    id: string;
    sleeperPlayerId?: string;
    label: string;
    position: string | null;
  }[];
  picks: { id: string; label: string; sleeperAvatarId?: string | null }[];
};

type AssetChip = {
  label: string;
  kind: string;
  sleeperId?: string;
  sleeperAvatarId?: string | null;
  position?: string | null;
};

type Proposal = {
  give: AssetChip[];
  receive: AssetChip[];
  partnerGiveTotal: number;
  partnerReceiveTotal: number;
  youGiveTotal: number;
  youReceiveTotal: number;
  communityGiveTotal: number;
  communityReceiveTotal: number;
  reason: string;
};

const POSITION_ORDER = ["QB", "RB", "WR", "TE"];

function AssetPhotos({ assets }: { assets: AssetChip[] }) {
  return (
    <div className="stack" style={{ gap: "0.4rem", marginTop: "0.4rem" }}>
      {assets.map((a) => (
        <span
          key={`${a.kind}-${a.sleeperId || a.sleeperAvatarId || a.label}`}
          style={{ display: "flex", alignItems: "center", gap: "0.5rem" }}
        >
          <PlayerPhoto
            sleeperPlayerId={a.kind === "player" ? a.sleeperId : null}
            sleeperAvatarId={a.kind === "pick" ? a.sleeperAvatarId : null}
            name={a.label}
            size={34}
          />
          <span style={{ display: "grid", minWidth: 0 }}>
            <span style={{ fontSize: "0.9rem", fontWeight: 600 }}>{a.label}</span>
            {a.kind === "player" ? <PositionBadge position={a.position} /> : null}
          </span>
        </span>
      ))}
    </div>
  );
}

export function TradeFinderClient({ leagueId }: { leagueId: string }) {
  const [partners, setPartners] = useState<PartnerPayload[]>([]);
  const [partnerId, setPartnerId] = useState("");
  const [wantPlayers, setWantPlayers] = useState<string[]>([]);
  const [wantPicks, setWantPicks] = useState<string[]>([]);
  const [band, setBand] = useState(10);
  const [maxGive, setMaxGive] = useState(2);
  const [loading, setLoading] = useState(true);
  const [searching, setSearching] = useState(false);
  const [searched, setSearched] = useState(false);
  const [error, setError] = useState("");
  const [warnings, setWarnings] = useState<string[]>([]);
  const [proposals, setProposals] = useState<Proposal[]>([]);
  const resultsRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    let cancelled = false;
    (async () => {
      const res = await fetch(`/api/leagues/${leagueId}/finder`);
      const data = await res.json();
      if (cancelled) return;
      setLoading(false);
      if (!res.ok) {
        setError(data.error || "Failed to load finder");
        return;
      }
      setPartners(data.partners || []);
      if (data.partners?.[0]) setPartnerId(data.partners[0].team.id);
    })();
    return () => {
      cancelled = true;
    };
  }, [leagueId]);

  const partner = useMemo(
    () => partners.find((p) => p.team.id === partnerId),
    [partners, partnerId],
  );

  const sortedPlayers = useMemo(() => {
    if (!partner) return [];
    const rank = (p: string | null) => {
      const i = POSITION_ORDER.indexOf(p || "");
      return i === -1 ? 99 : i;
    };
    return [...partner.players].sort(
      (a, b) => rank(a.position) - rank(b.position) || a.label.localeCompare(b.label),
    );
  }, [partner]);

  function toggle(list: string[], id: string, setter: (v: string[]) => void) {
    setter(list.includes(id) ? list.filter((x) => x !== id) : [...list, id]);
  }

  const selectedCount = wantPlayers.length + wantPicks.length;

  async function search() {
    setSearching(true);
    setError("");
    setWarnings([]);
    setProposals([]);
    const res = await fetch(`/api/leagues/${leagueId}/finder`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        partnerTeamId: partnerId,
        wantPlayerIds: wantPlayers,
        wantPickIds: wantPicks,
        fairnessBand: band / 100,
        maxGiveAssets: maxGive,
      }),
    });
    const data = await res.json();
    setSearching(false);
    setSearched(true);
    if (!res.ok) {
      setError(data.error || "Search failed");
      return;
    }
    setProposals(data.proposals || []);
    setWarnings(data.warnings || []);
    window.setTimeout(
      () => resultsRef.current?.scrollIntoView({ behavior: "smooth", block: "start" }),
      50,
    );
  }

  if (loading) return <p className="muted">Loading Trade Finder…</p>;

  return (
    <div className="stack">
      <div className="panel stack">
        <div>
          <label className="label" htmlFor="partner">
            Trade partner
          </label>
          <select
            className="input"
            id="partner"
            value={partnerId}
            onChange={(e) => {
              setPartnerId(e.target.value);
              setWantPlayers([]);
              setWantPicks([]);
              setProposals([]);
              setSearched(false);
            }}
          >
            {partners.map((p) => (
              <option key={p.team.id} value={p.team.id}>
                {p.team.teamName || p.team.displayName}
                {p.team.claimed ? "" : " (no board yet)"}
              </option>
            ))}
          </select>
        </div>

        <details>
          <summary className="muted" style={{ cursor: "pointer" }}>
            Options: within {band}% · up to {maxGive} asset{maxGive === 1 ? "" : "s"} from you
          </summary>
          <div className="stack" style={{ marginTop: "0.75rem" }}>
            <div>
              <label className="label" htmlFor="band">
                How fair to your partner ({band}%)
              </label>
              <input
                className="input"
                id="band"
                type="range"
                min={5}
                max={25}
                value={band}
                onChange={(e) => setBand(Number(e.target.value))}
              />
            </div>
            <div>
              <span className="label">Most assets you&apos;d give</span>
              <div className="seg">
                {[1, 2, 3, 4].map((n) => (
                  <button
                    key={n}
                    type="button"
                    className={maxGive === n ? "on" : ""}
                    onClick={() => setMaxGive(n)}
                  >
                    {n}
                  </button>
                ))}
              </div>
            </div>
          </div>
        </details>
      </div>

      {partner ? (
        <div className="stack">
          <h3 style={{ margin: 0 }}>Tap what you want</h3>
          <div className="pick-grid">
            {sortedPlayers.map((p) => {
              const on = wantPlayers.includes(p.id);
              return (
                <button
                  key={p.id}
                  type="button"
                  className={`pick-tile ${on ? "on" : ""}`}
                  aria-pressed={on}
                  onClick={() => toggle(wantPlayers, p.id, setWantPlayers)}
                >
                  <PlayerPhoto sleeperPlayerId={p.sleeperPlayerId} name={p.label} size={36} />
                  <span className="pick-tile-text">
                    <strong>{p.label}</strong>
                    <PositionBadge position={p.position} />
                  </span>
                  {on ? <span className="pick-check">✓</span> : null}
                </button>
              );
            })}
          </div>
          {partner.picks.length > 0 ? (
            <>
              <h3 style={{ margin: "0.5rem 0 0" }}>Picks</h3>
              <div className="pick-grid">
                {partner.picks.map((p) => {
                  const on = wantPicks.includes(p.id);
                  return (
                    <button
                      key={p.id}
                      type="button"
                      className={`pick-tile ${on ? "on" : ""}`}
                      aria-pressed={on}
                      onClick={() => toggle(wantPicks, p.id, setWantPicks)}
                    >
                      <PlayerPhoto sleeperAvatarId={p.sleeperAvatarId} name={p.label} size={36} />
                      <span className="pick-tile-text">
                        <strong>{p.label}</strong>
                      </span>
                      {on ? <span className="pick-check">✓</span> : null}
                    </button>
                  );
                })}
              </div>
            </>
          ) : null}
        </div>
      ) : null}

      <div ref={resultsRef} className="stack" style={{ scrollMarginTop: "1rem" }}>
        {error ? <p className="error">{error}</p> : null}
        {warnings.map((w) => (
          <p key={w} className="error">
            {w}
          </p>
        ))}
        {searched && !searching && proposals.length === 0 && !error ? (
          <p className="muted">
            No fair packages found. Try a wider fairness range or allow more assets in Options.
          </p>
        ) : null}
        {proposals.length > 0 ? <h3 style={{ margin: 0 }}>Offers they&apos;d accept</h3> : null}
        {proposals.map((p, idx) => (
          <div className="proposal" key={idx}>
            <div className="trade-sides">
              <div>
                <span className="label" style={{ margin: 0 }}>
                  You give
                </span>
                <AssetPhotos assets={p.give} />
              </div>
              <div>
                <span className="label" style={{ margin: 0 }}>
                  You get
                </span>
                <AssetPhotos assets={p.receive} />
              </div>
            </div>
            <div className="metrics">
              <div className="metric">
                <span>Partner</span>
                <strong>
                  {Math.round(p.partnerGiveTotal)} → {Math.round(p.partnerReceiveTotal)}
                </strong>
              </div>
              <div className="metric">
                <span>You</span>
                <strong>
                  {Math.round(p.youGiveTotal)} → {Math.round(p.youReceiveTotal)}
                </strong>
              </div>
              <div className="metric">
                <span>Market</span>
                <strong>
                  {Math.round(p.communityGiveTotal)} → {Math.round(p.communityReceiveTotal)}
                </strong>
              </div>
            </div>
            <p className="muted" style={{ margin: "0.6rem 0 0", fontSize: "0.85rem" }}>
              {p.reason}
            </p>
          </div>
        ))}
      </div>

      <div className="save-bar">
        <span className="muted">
          {selectedCount === 0 ? "Tap players or picks above" : `${selectedCount} selected`}
        </span>
        <button
          className="btn"
          type="button"
          onClick={search}
          disabled={searching || !partnerId || selectedCount === 0}
        >
          {searching ? "Finding…" : "Find trades"}
        </button>
      </div>
    </div>
  );
}
