"use client";

import { useRouter } from "next/navigation";
import { FormEvent, useEffect, useState } from "react";
import {
  getSavedUsername,
  saveLeagueCodes,
  setDeviceProof,
  setSavedUsername,
} from "@/lib/device-storage";

export function EnterCodeForm({ initialCode = "" }: { initialCode?: string }) {
  const router = useRouter();
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);
  const [defaultUser, setDefaultUser] = useState("");

  useEffect(() => {
    setDefaultUser(getSavedUsername());
  }, []);

  async function onSubmit(e: FormEvent<HTMLFormElement>) {
    e.preventDefault();
    setLoading(true);
    setError("");
    const form = new FormData(e.currentTarget);
    const sleeperUsername = String(form.get("sleeperUsername") || "").trim();
    const res = await fetch("/api/access", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        code: String(form.get("code")),
        sleeperUsername: sleeperUsername || undefined,
      }),
    });
    const data = await res.json();
    setLoading(false);
    if (!res.ok) {
      setError(data.error || "Invalid code");
      return;
    }
    if (data.deviceProof) setDeviceProof(data.deviceProof);
    if (sleeperUsername) setSavedUsername(sleeperUsername);
    if (data.inviteCode && data.adminCode && data.leagueId) {
      saveLeagueCodes({
        inviteCode: data.inviteCode,
        adminCode: data.adminCode,
        leagueId: data.leagueId,
        name: data.name || "League",
      });
    } else if (data.inviteCode && data.leagueId) {
      saveLeagueCodes({
        inviteCode: data.inviteCode,
        adminCode: "",
        leagueId: data.leagueId,
        name: data.name || "League",
      });
    }
    router.push(`/leagues/${data.leagueId}`);
    router.refresh();
  }

  return (
    <form className="stack" onSubmit={onSubmit}>
      <div>
        <label className="label" htmlFor="code">
          Invite or admin code
        </label>
        <input
          className="input"
          id="code"
          name="code"
          defaultValue={initialCode}
          placeholder="abcd-efgh"
          autoComplete="one-time-code"
          required
        />
      </div>
      <div>
        <label className="label" htmlFor="sleeperUsername">
          Sleeper username (reconnects your team)
        </label>
        <input
          className="input"
          id="sleeperUsername"
          name="sleeperUsername"
          placeholder="your_sleeper_name"
          defaultValue={defaultUser}
        />
      </div>
      <p className="muted" style={{ margin: 0, fontSize: "0.9rem" }}>
        Enter a code once on this phone — then use <strong>Continue on this device</strong>.
        No email or password account.
      </p>
      {error ? <p className="error">{error}</p> : null}
      <button className="btn" type="submit" disabled={loading}>
        {loading ? "Checking…" : "Enter league"}
      </button>
    </form>
  );
}
