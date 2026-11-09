"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import { PlayerPhoto } from "@/components/PlayerPhoto";
import { formatStars, packageTradeValue, starsForPackageValue, STAR_MAX } from "@/lib/stars";

type RosterRow = {
  kind: "player" | "pick";
  id: string;
  sleeperPlayerId?: string;
  sleeperAvatarId?: string | null;
  label: string;
  position?: string | null;
  value: number;
  market: number | null;
  league: number | null;
};

type OfferAsset = {
  kind: "player" | "pick";
  id: string;
  label: string;
  stars: number;
  sleeperPlayerId?: string;
  sleeperAvatarId?: string | null;
  position?: string | null;
};

type Offer = {
  teamId: string;
  teamLabel: string;
  teamAvatar: string | null;
  assets: OfferAsset[];
  tv: number;
  impliedStars: number;
};

type HistoryAsset = {
  kind: "player" | "pick";
  label: string;
  sleeperPlayerId?: string;
  position?: string | null;
  stars: number;
};

type HistoryTrade = {
  id: string;
  created: number;
  season: string;
  sides: { rosterId: number; teamLabel: string; receives: HistoryAsset[]; tv: number }[];
};

type Bounds = { low: number | null; high: number | null; round: number };

const keyOf = (r: { kind: string; id: string }) => `${r.kind}:${r.id}`;

function Assets({ assets }: { assets: { kind: string; label: string; sleeperPlayerId?: string; sleeperAvatarId?: string | null; stars: number }[] }) {
  return (
    <div style={{ display: "flex", flexWrap: "wrap", gap: "0.5rem", marginTop: "0.4rem" }}>
      {assets.map((a, i) => (
        <span
          key={`${a.label}-${i}`}
          style={{ display: "inline-flex", alignItems: "center", gap: "0.35rem" }}
        >
          <PlayerPhoto
            sleeperPlayerId={a.kind === "player" ? a.sleeperPlayerId : null}
            sleeperAvatarId={a.kind === "pick" ? a.sleeperAvatarId : null}
            name={a.label}
            size={32}
          />
          <span style={{ fontSize: "0.9rem" }}>
            {a.label} <span className="muted">{formatStars(a.stars)}</span>
          </span>
        </span>
      ))}
    </div>
  );
}

export function ValueLabClient({ leagueId }: { leagueId: string }) {
  const doneKey = `stf_lab_done_${leagueId}`;
  const [roster, setRoster] = useState<RosterRow[]>([]);
  const [subjectKey, setSubjectKey] = useState("");
  const [bounds, setBounds] = useState<Bounds>({ low: null, high: null, round: 1 });
  const [offers, setOffers] = useState<Offer[]>([]);
  const [maxed, setMaxed] = useState(false);
  const [loading, setLoading] = useState(true);
  const [loadingOffers, setLoadingOffers] = useState(false);
  const [error, setError] = useState("");
  const [result, setResult] = useState("");
  const [done, setDone] = useState<Set<string>>(new Set());
  const [history, setHistory] = useState<HistoryTrade[] | null>(null);

  const subject = roster.find((r) => keyOf(r) === subjectKey) ?? null;

  const loadOffers = useCallback(
    async (row: RosterRow, b: Bounds) => {
      setLoadingOffers(true);
      setError("");
      setOffers([]);
      const res = await fetch(`/api/leagues/${leagueId}/lab`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ kind: row.kind, id: row.id, low: b.low, high: b.high }),
      });
      const data = await res.json();
      setLoadingOffers(false);
      if (!res.ok) {
        setError(data.error || "Could not build offers");
        return;
      }
      setOffers(data.offers || []);
      setMaxed(Boolean(data.maxed));
    },
    [leagueId],
  );

  useEffect(() => {
    let cancelled = false;
    (async () => {
      let saved = new Set<string>();
      try {
        saved = new Set(JSON.parse(localStorage.getItem(doneKey) || "[]") as string[]);
      } catch {
        // ignore
      }
      const res = await fetch(`/api/leagues/${leagueId}/values`);
      const data = await res.json();
      if (cancelled) return;
      setLoading(false);
      if (!res.ok) {
        setError(data.error || "Could not load your roster");
        return;
      }
      const rows = ((data.roster || []) as RosterRow[])
        .filter((r) => (r.value || r.market || 0) >= 1)
        .sort((a, b) => b.value - a.value);
      setDone(saved);
      setRoster(rows);
      const first = rows.find((r) => !saved.has(keyOf(r))) ?? rows[0];
      if (first) {
        setSubjectKey(keyOf(first));
        void loadOffers(first, { low: null, high: null, round: 1 });
      }
    })();
    fetch(`/api/leagues/${leagueId}/history`)
      .then((r) => r.json())
      .then((d) => {
        if (!cancelled) setHistory(d.trades || []);
      })
      .catch(() => {
        if (!cancelled) setHistory([]);
      });
    return () => {
      cancelled = true;
    };
  }, [leagueId, doneKey, loadOffers]);

  function selectAsset(row: RosterRow) {
    const fresh = { low: null, high: null, round: 1 };
    setSubjectKey(keyOf(row));
    setBounds(fresh);
    setResult("");
    void loadOffers(row, fresh);
  }

  function markDone(row: RosterRow) {
    const next = new Set(done);
    next.add(keyOf(row));
    setDone(next);
    try {
      localStorage.setItem(doneKey, JSON.stringify([...next]));
    } catch {
      // ignore
    }
  }

  async function accept(tv: number) {
    if (!subject) return;
    setError("");
    const res = await fetch(`/api/leagues/${leagueId}/lab`, {
      method: "PUT",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ kind: subject.kind, id: subject.id, tv }),
    });
    const data = await res.json();
    if (!res.ok) {
      setError(data.error || "Save failed");
      return;
    }
    const before = subject.value;
    setRoster((rows) =>
      rows.map((r) => (keyOf(r) === subjectKey ? { ...r, value: data.stars } : r)),
    );
    markDone(subject);
    setOffers([]);
    setResult(
      `Saved: ${subject.label} is now ${formatStars(data.stars)} on your board (was ${formatStars(before)}).`,
    );
  }

  function needMore() {
    if (!subject || offers.length === 0) return;
    const top = Math.max(...offers.map((o) => o.tv));
    const low = Math.max(bounds.low ?? 0, top);
    const high = bounds.high != null && bounds.high > low * 1.05 ? bounds.high : null;
    const next = { low, high, round: bounds.round + 1 };
    setBounds(next);
    void loadOffers(subject, next);
  }

  function takeLess() {
    if (!subject || offers.length === 0) return;
    const bottom = Math.min(...offers.map((o) => o.tv));
    const high = bounds.high != null ? Math.min(bounds.high, bottom) : bottom;
    const low = bounds.low != null && bounds.low < high * 0.95 ? bounds.low : null;
    const next = { low, high, round: bounds.round + 1 };
    setBounds(next);
    void loadOffers(subject, next);
  }

  function nextAsset() {
    const idx = roster.findIndex((r) => keyOf(r) === subjectKey);
    const after = [...roster.slice(idx + 1), ...roster.slice(0, idx)];
    const target = after.find((r) => !done.has(keyOf(r))) ?? after[0];
    if (target) selectAsset(target);
  }

  const benchmark = useMemo(() => {
    if (!subject || !history) return { direct: [] as HistoryTrade[], similar: [] as HistoryTrade[] };
    const direct = subject.sleeperPlayerId
      ? history.filter((t) =>
          t.sides.some((s) => s.receives.some((a) => a.sleeperPlayerId === subject.sleeperPlayerId)),
        )
      : [];
    const ref = subject.market ?? subject.value;
    const similar = history
      .filter((t) => !direct.includes(t))
      .filter((t) =>
        t.sides.some((s) => {
          const best = Math.max(0, ...s.receives.map((a) => a.stars));
          return best > 0 && Math.abs(best - ref) <= 0.5;
        }),
      )
      .slice(0, 4);
    return { direct: direct.slice(0, 4), similar };
  }, [subject, history]);

  if (loading) return <p className="muted">Loading your roster…</p>;
  if (!roster.length) {
    return <p className="muted">{error || "No rated assets on your roster yet."}</p>;
  }

  const ratedCount = roster.filter((r) => done.has(keyOf(r))).length;
  // Best guess when no package exists in range: between bounds, or just past the one we have.
  const fallbackTv =
    bounds.low != null && bounds.high != null
      ? (bounds.low + bounds.high) / 2
      : bounds.low != null
        ? bounds.low * 1.15
        : bounds.high != null
          ? bounds.high * 0.85
          : null;

  return (
    <div className="stack">
      <div className="panel stack">
        <div>
          <label className="label" htmlFor="labAsset">
            Your asset ({ratedCount}/{roster.length} priced)
          </label>
          <select
            className="input"
            id="labAsset"
            value={subjectKey}
            onChange={(e) => {
              const row = roster.find((r) => keyOf(r) === e.target.value);
              if (row) selectAsset(row);
            }}
          >
            {roster.map((r) => (
              <option key={keyOf(r)} value={keyOf(r)}>
                {done.has(keyOf(r)) ? "✓ " : ""}
                {r.label} {r.position && r.position !== "PICK" ? `(${r.position})` : ""} —{" "}
                {formatStars(r.value)}
              </option>
            ))}
          </select>
        </div>
        {subject ? (
          <div style={{ display: "flex", alignItems: "center", gap: "0.75rem" }}>
            <PlayerPhoto
              sleeperPlayerId={subject.kind === "player" ? subject.sleeperPlayerId : null}
              sleeperAvatarId={subject.kind === "pick" ? subject.sleeperAvatarId : null}
              name={subject.label}
              size={56}
            />
            <div>
              <h2 style={{ margin: 0 }}>Mock trades for {subject.label}</h2>
              <p className="muted" style={{ margin: 0 }}>
                Your board {formatStars(subject.value)}
                {subject.league != null ? ` · League ${formatStars(subject.league)}` : ""}
                {subject.market != null ? ` · Market ${formatStars(subject.market)}` : ""}
              </p>
            </div>
          </div>
        ) : null}
      </div>

      {result ? (
        <div className="panel stack">
          <p className="success" style={{ margin: 0 }}>
            {result}
          </p>
          <div style={{ display: "flex", gap: "0.5rem", flexWrap: "wrap" }}>
            <button className="btn" type="button" onClick={nextAsset}>
              Next asset →
            </button>
            {subject ? (
              <button
                className="btn btn-secondary"
                type="button"
                onClick={() => selectAsset(subject)}
              >
                Re-test this one
              </button>
            ) : null}
          </div>
        </div>
      ) : (
        <div className="stack">
          <p className="muted" style={{ margin: 0 }}>
            Round {bounds.round}. Pick the <strong>cheapest</strong> offer you&apos;d still accept.
            That sets your rating. Offers use your own board&apos;s values for what you&apos;d get.
          </p>

          {loadingOffers ? <p className="muted">Building offers…</p> : null}

          {!loadingOffers && maxed ? (
            <div className="panel stack">
              <p style={{ margin: 0 }}>
                Nothing in the league beats what you&apos;ve turned down. You see{" "}
                {subject?.label} as a top-tier asset.
              </p>
              <button
                className="btn"
                type="button"
                onClick={() => accept(packageTradeValue([STAR_MAX]))}
              >
                Set to {formatStars(STAR_MAX)}
              </button>
            </div>
          ) : null}

          {!loadingOffers && !maxed && offers.length === 0 && subject ? (
            <div className="panel stack">
              <p className="muted" style={{ margin: 0 }}>
                No team has a package at this price range.
              </p>
              {fallbackTv != null ? (
                <button className="btn" type="button" onClick={() => accept(fallbackTv)}>
                  Use my answers so far ({formatStars(starsForPackageValue(fallbackTv))})
                </button>
              ) : null}
            </div>
          ) : null}

          {offers.map((o, idx) => (
            <div className="proposal" key={`${o.teamId}-${idx}`}>
              <div style={{ display: "flex", alignItems: "center", gap: "0.5rem" }}>
                <PlayerPhoto sleeperAvatarId={o.teamAvatar} name={o.teamLabel} size={28} />
                <strong>{o.teamLabel} offers</strong>
              </div>
              <Assets assets={o.assets} />
              <div
                style={{
                  display: "flex",
                  justifyContent: "space-between",
                  alignItems: "center",
                  gap: "0.75rem",
                  flexWrap: "wrap",
                  marginTop: "0.75rem",
                }}
              >
                <span className="muted" style={{ fontSize: "0.9rem" }}>
                  Value {Math.round(o.tv)} · taking it rates {subject?.label} ≈{" "}
                  {formatStars(o.impliedStars)}
                </span>
                <button className="btn" type="button" onClick={() => accept(o.tv)}>
                  I&apos;d take this
                </button>
              </div>
            </div>
          ))}

          {offers.length > 0 && !loadingOffers ? (
            <div style={{ display: "flex", gap: "0.5rem", flexWrap: "wrap" }}>
              <button className="btn" type="button" onClick={needMore}>
                None. I need more
              </button>
              <button className="btn btn-secondary" type="button" onClick={takeLess}>
                I&apos;d take even less
              </button>
              <button className="btn btn-secondary" type="button" onClick={nextAsset}>
                Skip
              </button>
            </div>
          ) : null}
        </div>
      )}

      {error ? <p className="error">{error}</p> : null}

      <div className="panel stack">
        <h2 style={{ margin: 0 }}>League trade history</h2>
        <p className="muted" style={{ margin: 0, fontSize: "0.9rem" }}>
          Real trades from this league (this season and last), valued at today&apos;s market ★.
        </p>
        {history == null ? <p className="muted">Loading trades…</p> : null}
        {history && history.length === 0 ? (
          <p className="muted">No completed trades found yet.</p>
        ) : null}
        {benchmark.direct.length > 0 ? (
          <>
            <h3 style={{ margin: "0.5rem 0 0" }}>Deals involving {subject?.label}</h3>
            {benchmark.direct.map((t) => (
              <TradeCard key={t.id} trade={t} />
            ))}
          </>
        ) : null}
        {benchmark.similar.length > 0 ? (
          <>
            <h3 style={{ margin: "0.5rem 0 0" }}>Comparable deals (similar-value headliner)</h3>
            {benchmark.similar.map((t) => (
              <TradeCard key={t.id} trade={t} />
            ))}
          </>
        ) : null}
        {history && history.length > 0 && !benchmark.direct.length && !benchmark.similar.length ? (
          <p className="muted">No league trades near this asset&apos;s value yet.</p>
        ) : null}
      </div>
    </div>
  );
}

function TradeCard({ trade }: { trade: HistoryTrade }) {
  const date = new Date(trade.created).toLocaleDateString();
  return (
    <div className="proposal">
      <p className="muted" style={{ margin: 0, fontSize: "0.8rem" }}>
        {date} · {trade.season} season
      </p>
      <div className="grid-2" style={{ marginTop: "0.4rem" }}>
        {trade.sides.map((s) => (
          <div key={s.rosterId}>
            <strong>{s.teamLabel} got</strong>{" "}
            <span className="muted">(value {Math.round(s.tv)})</span>
            {s.receives.length ? (
              <Assets assets={s.receives} />
            ) : (
              <p className="muted" style={{ margin: "0.3rem 0 0" }}>
                Nothing tracked (FAAB only)
              </p>
            )}
          </div>
        ))}
      </div>
    </div>
  );
}
