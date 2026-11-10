"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useEffect, useState } from "react";
import { setDeviceProof, setSavedUsername } from "@/lib/device-storage";

export function RedeemDeviceLink({ token }: { token: string }) {
  const router = useRouter();
  const [error, setError] = useState("");

  useEffect(() => {
    let cancelled = false;
    (async () => {
      const res = await fetch("/api/access/link", {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ token }),
      });
      const data = await res.json();
      if (cancelled) return;
      if (!res.ok) {
        setError(data.error || "Sign-in link didn't work");
        return;
      }
      if (data.deviceProof) setDeviceProof(data.deviceProof);
      if (data.sleeperUsername) setSavedUsername(data.sleeperUsername);
      const ids: string[] = data.leagueIds || [];
      router.replace(ids.length === 1 ? `/leagues/${ids[0]}` : "/dashboard");
      router.refresh();
    })();
    return () => {
      cancelled = true;
    };
  }, [token, router]);

  if (error) {
    return (
      <div className="stack">
        <p className="error">{error}</p>
        <Link className="btn" href="/join">
          Enter a code instead
        </Link>
      </div>
    );
  }
  return <p className="muted">One moment…</p>;
}
