"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useEffect, useState } from "react";
import {
  forgetThisDevice,
  getDeviceProof,
  getSavedCodes,
  getSavedUsername,
  setDeviceProof,
} from "@/lib/device-storage";

export function ContinueOnDevice() {
  const router = useRouter();
  const [hasProof, setHasProof] = useState(false);
  const [savedCount, setSavedCount] = useState(0);
  const [username, setUsername] = useState("");
  const [status, setStatus] = useState("");
  const [loading, setLoading] = useState(false);
  const [autoTried, setAutoTried] = useState(false);

  useEffect(() => {
    setHasProof(Boolean(getDeviceProof()));
    setSavedCount(getSavedCodes().length);
    setUsername(getSavedUsername());
  }, []);

  async function restore(auto = false) {
    const deviceProof = getDeviceProof();
    if (!deviceProof) {
      if (!auto) setStatus("No saved login on this device yet.");
      return;
    }
    setLoading(true);
    setStatus(auto ? "Restoring this device…" : "");
    const res = await fetch("/api/access/device", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        deviceProof,
        sleeperUsername: getSavedUsername() || undefined,
      }),
    });
    const data = await res.json();
    setLoading(false);
    if (!res.ok) {
      if (!auto) {
        setStatus(data.error || "Could not restore — enter a code once");
      }
      if (res.status === 401) {
        forgetThisDevice();
        setHasProof(false);
      }
      return;
    }
    if (data.deviceProof) setDeviceProof(data.deviceProof);
    setStatus(`Welcome back — ${data.leagueCount} league(s) unlocked`);
    router.push("/dashboard");
    router.refresh();
  }

  useEffect(() => {
    if (autoTried || !hasProof) return;
    setAutoTried(true);
    // Quiet restore when cookie session is empty but this phone has a proof
    (async () => {
      const sessionRes = await fetch("/api/session");
      const session = await sessionRes.json();
      if ((session.memberships || []).length === 0) {
        await restore(true);
      }
    })();
    // eslint-disable-next-line react-hooks/exhaustive-deps -- run once when proof detected
  }, [hasProof, autoTried]);

  if (!hasProof && savedCount === 0) return null;

  return (
    <div className="panel stack">
      <h2 style={{ margin: 0 }}>Continue on this device</h2>
      <p className="muted" style={{ margin: 0 }}>
        No account needed. After you unlock once with a code, this phone remembers you
        securely for months{username ? ` (${username})` : ""}.
      </p>
      {hasProof ? (
        <button className="btn" type="button" disabled={loading} onClick={() => restore(false)}>
          {loading ? "Unlocking…" : "Continue where I left off"}
        </button>
      ) : (
        <p className="muted" style={{ margin: 0 }}>
          Codes are saved here — use{" "}
          <Link href="/join">Join</Link> and paste one, then this device will remember you.
        </p>
      )}
      {status ? (
        <p className={status.includes("Welcome") ? "success" : "muted"}>{status}</p>
      ) : null}
      <button
        className="btn btn-secondary"
        type="button"
        onClick={() => {
          forgetThisDevice();
          setHasProof(false);
          setSavedCount(0);
          setStatus("Forgot this device.");
        }}
      >
        Forget this device
      </button>
    </div>
  );
}
