"use client";

import { useRouter } from "next/navigation";
import { FormEvent, useState } from "react";

export function EnterCodeForm({ initialCode = "" }: { initialCode?: string }) {
  const router = useRouter();
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);

  async function onSubmit(e: FormEvent<HTMLFormElement>) {
    e.preventDefault();
    setLoading(true);
    setError("");
    const form = new FormData(e.currentTarget);
    const res = await fetch("/api/access", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ code: String(form.get("code")) }),
    });
    const data = await res.json();
    setLoading(false);
    if (!res.ok) {
      setError(data.error || "Invalid code");
      return;
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
          placeholder="Paste code from your commissioner"
          required
        />
      </div>
      <p className="muted" style={{ margin: 0, fontSize: "0.9rem" }}>
        No email or password. The code unlocks this browser for that league only.
      </p>
      {error ? <p className="error">{error}</p> : null}
      <button className="btn" type="submit" disabled={loading}>
        {loading ? "Checking…" : "Enter league"}
      </button>
    </form>
  );
}
