const KNOWN = new Set(["QB", "RB", "WR", "TE", "K", "DEF"]);

/** Sleeper-style colored position tag (QB pink, RB teal, WR blue, TE orange). */
export function PositionBadge({ position }: { position?: string | null }) {
  if (!position) return null;
  const pos = position.toUpperCase();
  const label = pos === "PICK" ? "PICK" : pos;
  return <span className={`pos-badge ${KNOWN.has(pos) ? `pos-${pos}` : ""}`}>{label}</span>;
}
