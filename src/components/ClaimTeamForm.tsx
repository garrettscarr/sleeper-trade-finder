"use client";

import { useRouter } from "next/navigation";
import { FormEvent, useState } from "react";
import { PlayerPhoto } from "@/components/PlayerPhoto";
import {
  getSavedUsername,
  setDeviceProof,
  setSavedUsername,
} from "@/lib/device-storage";

type TeamOption = {
  id: string;
  label: string;
  avatar?: string | null;
  claimed: boolean;
  isCommissioner: boolean;
};

export function ClaimTeamForm({
  leagueId,
  teams,
}: {
  leagueId: string;
  teams: TeamOption[];
}) {
  const router = useRouter();
  const [error, setError] = useState("");
  const [loadingId, setLoadingId] = useState("");
  const [askUsernameFor, setAskUsernameFor] = useState<TeamOption | null>(null);

  async function claim(team: TeamOption, sleeperUsername?: string) {
    setLoadingId(team.id);
    setError("");
    const res = await fetch(`/api/leagues/${leagueId}/claim`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ teamId: team.id, sleeperUsername }),
    });
    const data = await res.json();
    setLoadingId("");
    if (!res.ok) {
      if (data.needsUsername) {
        setAskUsernameFor(team);
      } else {
        setError(data.error || "Claim failed");
      }
      return;
    }
    if (data.deviceProof) setDeviceProof(data.deviceProof);
    if (sleeperUsername) setSavedUsername(sleeperUsername);
    router.refresh();
    router.push(`/leagues/${leagueId}/lab`);
  }

  function onTap(team: TeamOption) {
    setError("");
    if (!team.claimed) {
      void claim(team);
      return;
    }
    if (team.isCommissioner) {
      setAskUsernameFor(null);
      setError(
        "That's the commissioner's team and it's already signed in elsewhere. Use “Sign in on another device” from that phone, or the admin code.",
      );
      return;
    }
    const saved = getSavedUsername();
    if (saved) {
      void claim(team, saved);
      return;
    }
    setAskUsernameFor(team);
  }

  function submitUsername(e: FormEvent<HTMLFormElement>) {
    e.preventDefault();
    if (!askUsernameFor) return;
    const form = new FormData(e.currentTarget);
    const name = String(form.get("sleeperUsername") || "").trim();
    if (name) void claim(askUsernameFor, name);
  }

  return (
    <div className="stack">
      <p className="muted" style={{ margin: 0 }}>
        Tap your team. That&apos;s it. This device remembers you.
      </p>
      <div className="team-grid">
        {teams.map((t) => (
          <button
            key={t.id}
            type="button"
            className="team-tile"
            disabled={Boolean(loadingId)}
            onClick={() => onTap(t)}
          >
            <PlayerPhoto sleeperAvatarId={t.avatar} name={t.label} size={40} />
            <span style={{ textAlign: "left" }}>
              <strong style={{ display: "block" }}>{t.label}</strong>
              <span className="muted" style={{ fontSize: "0.8rem" }}>
                {loadingId === t.id
                  ? "Signing in…"
                  : t.claimed
                    ? "Claimed: tap if this is you"
                    : t.isCommissioner
                      ? "Commissioner"
                      : "Open"}
              </span>
            </span>
          </button>
        ))}
      </div>

      {askUsernameFor ? (
        <form className="panel stack" onSubmit={submitUsername}>
          <p style={{ margin: 0 }}>
            <strong>{askUsernameFor.label}</strong> is signed in on another device. Enter your
            Sleeper username to move it here.
          </p>
          <input
            className="input"
            name="sleeperUsername"
            placeholder="your_sleeper_name"
            autoFocus
            required
          />
          <button className="btn" type="submit" disabled={Boolean(loadingId)}>
            Reconnect
          </button>
        </form>
      ) : null}

      {error ? <p className="error">{error}</p> : null}
    </div>
  );
}
