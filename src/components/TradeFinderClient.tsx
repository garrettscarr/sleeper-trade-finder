"use client";

import { useEffect, useMemo, useState } from "react";
import { PlayerPhoto } from "@/components/PlayerPhoto";

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

function AssetPhotos({ assets }: { assets: AssetChip[] }) {
  return (
    <div style={{ display: "flex", flexWrap: "wrap", gap: "0.45rem", marginTop: "0.35rem" }}>
      {assets.map((a) => (
        <span
          key={`${a.kind}-${a.sleeperId || a.sleeperAvatarId || a.label}`}
          style={{ display: "inline-flex", alignItems: "center", gap: "0.35rem" }}
        >
          <PlayerPhoto
            sleeperPlayerId={a.kind === "player" ? a.sleeperId : null}
            sleeperAvatarId={a.kind === "pick" ? a.sleeperAvatarId : null}
            name={a.label}
            size={32}
          />
          <span style={{ fontSize: "0.9rem" }}>{a.label}</span>
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
  const [error, setError] = useState("");
  const [warnings, setWarnings] = useState<string[]>([]);
  const [proposals, setProposals] = useState<Proposal[]>([]);

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

  function toggle(list: string[], id: string, setter: (v: string[]) => void) {
    setter(list.includes(id) ? list.filter((x) => x !== id) : [...list, id]);
  }

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
    if (!res.ok) {
      setError(data.error || "Search failed");
      return;
    }
    setProposals(data.proposals || []);
    setWarnings(data.warnings || []);
  }

  if (loading) return <p className="muted">Loading Trade Finder…</p>;

  return (
    <div className="stack">
      <div className="panel stack">
        <div className="grid-2">
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
              }}
            >
              {partners.map((p) => (
                <option key={p.team.id} value={p.team.id}>
                  {p.team.teamName || p.team.displayName}
                  {p.team.claimed ? "" : " (no personal board yet)"}
                </option>
              ))}
            </select>
          </div>
          <div className="grid-2">
            <div>
              <label className="label" htmlFor="band">
                Fairness band ({band}%)
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
              <label className="label" htmlFor="maxGive">
                Max assets you give
              </label>
              <select
                className="input"
                id="maxGive"
                value={maxGive}
                onChange={(e) => setMaxGive(Number(e.target.value))}
              >
                <option value={1}>1</option>
                <option value={2}>2</option>
                <option value={3}>3</option>
              </select>
            </div>
          </div>
        </div>

        {partner ? (
          <div className="grid-2">
            <div>
              <h3 style={{ margin: "0 0 0.5rem" }}>Want from partner</h3>
              <div className="stack">
                {partner.players.map((p) => (
                  <label key={p.id} style={{ display: "flex", gap: "0.55rem", alignItems: "center" }}>
                    <input
                      type="checkbox"
                      checked={wantPlayers.includes(p.id)}
                      onChange={() => toggle(wantPlayers, p.id, setWantPlayers)}
                    />
                    <PlayerPhoto
                      sleeperPlayerId={p.sleeperPlayerId}
                      name={p.label}
                      size={34}
                    />
                    <span>
                      {p.label}{" "}
                      <span className="muted">{p.position}</span>
                    </span>
                  </label>
                ))}
              </div>
            </div>
            <div>
              <h3 style={{ margin: "0 0 0.5rem" }}>Want picks</h3>
              <div className="stack">
                {partner.picks.length === 0 ? (
                  <p className="muted">No future picks on this roster.</p>
                ) : (
                  partner.picks.map((p) => (
                    <label
                      key={p.id}
                      style={{ display: "flex", gap: "0.55rem", alignItems: "center" }}
                    >
                      <input
                        type="checkbox"
                        checked={wantPicks.includes(p.id)}
                        onChange={() => toggle(wantPicks, p.id, setWantPicks)}
                      />
                      <PlayerPhoto
                        sleeperAvatarId={p.sleeperAvatarId}
                        name={p.label}
                        size={34}
                      />
                      <span>{p.label}</span>
                    </label>
                  ))
                )}
              </div>
            </div>
          </div>
        ) : null}

        {error ? <p className="error">{error}</p> : null}
        <button className="btn" onClick={search} disabled={searching || !partnerId}>
          {searching ? "Finding packages…" : "Find trades"}
        </button>
      </div>

      {warnings.map((w) => (
        <p key={w} className="error">
          {w}
        </p>
      ))}

      <div className="stack">
        {proposals.length === 0 && !searching ? (
          <p className="muted">
            Select assets you want and run Find trades. Matching uses a premium curve
            (mid-1st ≈ 100) so elites cost multiple firsts — not raw ★ addition.
          </p>
        ) : null}
        {proposals.map((p, idx) => (
          <div className="proposal" key={idx}>
            <div className="grid-2">
              <div>
                <strong>You give</strong>
                <AssetPhotos assets={p.give} />
              </div>
              <div>
                <strong>You get</strong>
                <AssetPhotos assets={p.receive} />
              </div>
            </div>
            <p className="muted" style={{ margin: "0.65rem 0 0" }}>
              {p.reason}
            </p>
            <div className="metrics">
              <div className="metric">
                <span>Partner value</span>
                <strong>
                  {Math.round(p.partnerGiveTotal)} → {Math.round(p.partnerReceiveTotal)}
                </strong>
              </div>
              <div className="metric">
                <span>Your board</span>
                <strong>
                  {Math.round(p.youGiveTotal)} → {Math.round(p.youReceiveTotal)}
                </strong>
              </div>
              <div className="metric">
                <span>Market</span>
                <strong>
                  {Math.round(p.communityGiveTotal)} →{" "}
                  {Math.round(p.communityReceiveTotal)}
                </strong>
              </div>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}
