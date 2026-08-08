"use client";

import { useRouter } from "next/navigation";
import { useEffect, useState } from "react";
import { EnterCodeForm } from "./EnterCodeForm";

export function AutoUnlock({ code }: { code: string }) {
  const router = useRouter();
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    let cancelled = false;
    (async () => {
      const res = await fetch("/api/access", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ code }),
      });
      const data = await res.json();
      if (cancelled) return;
      if (!res.ok) {
        setLoading(false);
        setError(data.error || "Invalid code");
        return;
      }
      router.replace(`/leagues/${data.leagueId}`);
      router.refresh();
    })();
    return () => {
      cancelled = true;
    };
  }, [code, router]);

  if (loading && !error) {
    return <p className="muted">Unlocking league…</p>;
  }

  return (
    <div className="stack">
      {error ? <p className="error">{error}</p> : null}
      <EnterCodeForm initialCode={code} />
    </div>
  );
}
