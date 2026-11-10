"use client";

import { useState } from "react";
import { getSavedUsername } from "@/lib/device-storage";

export function SignInAnotherDevice() {
  const [url, setUrl] = useState("");
  const [status, setStatus] = useState("");
  const [loading, setLoading] = useState(false);

  async function makeLink() {
    setLoading(true);
    setStatus("");
    const res = await fetch("/api/access/link", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ sleeperUsername: getSavedUsername() || undefined }),
    });
    const data = await res.json();
    setLoading(false);
    if (!res.ok) {
      setStatus(data.error || "Could not make a link");
      return;
    }
    const full = `${window.location.origin}${data.path}`;
    setUrl(full);
    try {
      await navigator.clipboard.writeText(full);
      setStatus("Copied. Text it to yourself and open it within 15 minutes.");
    } catch {
      setStatus("Copy the link below and open it within 15 minutes.");
    }
  }

  return (
    <div className="stack" style={{ gap: "0.5rem" }}>
      <button className="btn btn-secondary" type="button" disabled={loading} onClick={makeLink}>
        {loading ? "Making link…" : "Sign in on another device"}
      </button>
      {url ? (
        <code style={{ fontSize: "0.8rem", wordBreak: "break-all" }}>{url}</code>
      ) : null}
      {status ? <p className="muted" style={{ margin: 0 }}>{status}</p> : null}
      <p className="muted" style={{ margin: 0, fontSize: "0.8rem" }}>
        Moves your sign-in (including commissioner access) to your other phone or computer.
        Don&apos;t send it to anyone else.
      </p>
    </div>
  );
}
