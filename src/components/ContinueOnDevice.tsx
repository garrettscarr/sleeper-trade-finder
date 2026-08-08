"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useEffect, useState } from "react";
import {
  forgetThisDevice,
  getDeviceProof,
  getSavedCodes,
  getSavedUsername,
} from "@/lib/device-storage";
import { restoreDeviceSession } from "@/lib/restore-device";

export function ContinueOnDevice() {
  const router = useRouter();
  const [hasProof, setHasProof] = useState(false);
  const [savedCount, setSavedCount] = useState(0);
  const [username, setUsername] = useState("");
  const [status, setStatus] = useState("");
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    setHasProof(Boolean(getDeviceProof()));
    setSavedCount(getSavedCodes().length);
    setUsername(getSavedUsername());
  }, []);

  async function restore() {
    setLoading(true);
    setStatus("Restoring this device…");
    const result = await restoreDeviceSession();
    setLoading(false);
    if (!result.ok) {
      setStatus(result.reason);
      setHasProof(Boolean(getDeviceProof()));
      return;
    }
    setHasProof(true);
    setStatus(`Welcome back — ${result.leagueCount} league(s) unlocked`);
    router.push("/dashboard");
    router.refresh();
  }

  if (!hasProof && savedCount === 0) return null;

  return (
    <div className="panel stack">
      <h2 style={{ margin: 0 }}>Continue on this device</h2>
      <p className="muted" style={{ margin: 0 }}>
        Redeploys do not log you out. After you unlock once, this phone restores
        automatically{username ? ` (${username})` : ""}.
      </p>
      <button className="btn" type="button" disabled={loading} onClick={restore}>
        {loading ? "Unlocking…" : "Continue where I left off"}
      </button>
      {status ? (
        <p className={status.includes("Welcome") ? "success" : "muted"}>{status}</p>
      ) : null}
      {!hasProof && savedCount > 0 ? (
        <p className="muted" style={{ margin: 0 }}>
          Codes are saved on this phone — tap Continue (or use{" "}
          <Link href="/join">Join</Link> if that fails).
        </p>
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
