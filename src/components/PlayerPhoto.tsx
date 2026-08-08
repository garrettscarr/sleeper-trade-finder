"use client";

import { useState } from "react";
import { sleeperPlayerPhotoUrl, sleeperUserAvatarUrl } from "@/lib/sleeper-media";

export function PlayerPhoto({
  sleeperPlayerId,
  sleeperAvatarId,
  name,
  size = 40,
}: {
  sleeperPlayerId?: string | null;
  /** Sleeper user avatar id — used for draft picks (original team owner). */
  sleeperAvatarId?: string | null;
  name: string;
  size?: number;
}) {
  const src =
    sleeperPlayerPhotoUrl(sleeperPlayerId) || sleeperUserAvatarUrl(sleeperAvatarId);
  const [failed, setFailed] = useState(false);
  const initials = name
    .split(/\s+/)
    .filter(Boolean)
    .slice(0, 2)
    .map((p) => p[0]?.toUpperCase() ?? "")
    .join("");

  if (!src || failed) {
    return (
      <span
        aria-hidden
        style={{
          width: size,
          height: size,
          borderRadius: "50%",
          display: "inline-flex",
          alignItems: "center",
          justifyContent: "center",
          background: "var(--bg2)",
          border: "1px solid var(--line)",
          color: "var(--muted)",
          fontSize: size * 0.32,
          fontWeight: 700,
          flexShrink: 0,
        }}
      >
        {initials || "?"}
      </span>
    );
  }

  return (
    // eslint-disable-next-line @next/next/no-img-element
    <img
      src={src}
      alt=""
      width={size}
      height={size}
      loading="lazy"
      onError={() => setFailed(true)}
      style={{
        width: size,
        height: size,
        borderRadius: "50%",
        objectFit: "cover",
        background: "var(--bg2)",
        border: "1px solid var(--line)",
        flexShrink: 0,
      }}
    />
  );
}
