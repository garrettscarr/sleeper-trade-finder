"use client";

import {
  forgetThisDevice,
  getDeviceProof,
  getSavedCodes,
  getSavedUsername,
  setDeviceProof,
} from "@/lib/device-storage";

export type RestoreResult =
  | { ok: true; leagueCount: number; via: "session" | "proof" | "code"; restored: boolean }
  | { ok: false; reason: string };

/**
 * Re-establish the httpOnly session from this browser's saved proof or codes.
 * Safe to call on every page load when the session cookie is missing.
 */
export async function restoreDeviceSession(): Promise<RestoreResult> {
  const sessionRes = await fetch("/api/session");
  const session = await sessionRes.json();
  if ((session.memberships || []).length > 0) {
    return {
      ok: true,
      leagueCount: session.memberships.length,
      via: "session",
      restored: false,
    };
  }

  const username = getSavedUsername() || undefined;
  const proof = getDeviceProof();

  if (proof) {
    const res = await fetch("/api/access/device", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ deviceProof: proof, sleeperUsername: username }),
    });
    const data = await res.json();
    if (res.ok) {
      if (data.deviceProof) setDeviceProof(data.deviceProof);
      return {
        ok: true,
        leagueCount: data.leagueCount || 1,
        via: "proof",
        restored: true,
      };
    }
    // AUTH_SECRET rotate / expired proof — clear and fall through to saved codes
    if (res.status === 401) {
      // keep codes; only drop the broken proof token
      try {
        localStorage.removeItem("stf_device_proof");
      } catch {
        // ignore
      }
    }
  }

  const codes = getSavedCodes();
  for (const entry of codes) {
    const tryCodes = [entry.adminCode, entry.inviteCode].filter(Boolean);
    for (const code of tryCodes) {
      const res = await fetch("/api/access", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ code, sleeperUsername: username }),
      });
      const data = await res.json();
      if (res.ok) {
        if (data.deviceProof) setDeviceProof(data.deviceProof);
        return { ok: true, leagueCount: 1, via: "code", restored: true };
      }
    }
  }

  return {
    ok: false,
    reason: proof
      ? "Saved login failed — enter your code once more"
      : "No saved login on this device",
  };
}

export function clearBrokenDeviceLogin() {
  forgetThisDevice();
}
