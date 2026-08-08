"use client";

import { useEffect, useState } from "react";

export function CopyInviteLink({
  inviteCode,
  label = "Copy full invite link",
  successText = "Copied — ready to text your league",
}: {
  inviteCode: string;
  label?: string;
  successText?: string;
}) {
  const [url, setUrl] = useState(`/join/${inviteCode}`);
  const [status, setStatus] = useState("");

  useEffect(() => {
    setUrl(`${window.location.origin}/join/${inviteCode}`);
  }, [inviteCode]);

  async function copy() {
    const full = `${window.location.origin}/join/${inviteCode}`;
    try {
      await navigator.clipboard.writeText(full);
    } catch {
      const input = document.createElement("input");
      input.value = full;
      document.body.appendChild(input);
      input.select();
      document.execCommand("copy");
      document.body.removeChild(input);
    }
    setStatus(successText);
    window.setTimeout(() => setStatus(""), 2500);
  }

  return (
    <div className="stack" style={{ gap: "0.5rem" }}>
      <code style={{ fontSize: "0.95rem", wordBreak: "break-all" }}>{url}</code>
      <div style={{ display: "flex", flexWrap: "wrap", gap: "0.5rem", alignItems: "center" }}>
        <button className="btn" type="button" onClick={copy}>
          {label}
        </button>
        {status ? <span className="success">{status}</span> : null}
      </div>
    </div>
  );
}

/** Same URL shape as invite — /join/{adminCode} unlocks commissioner tools. Do not share. */
export function CopyAdminLink({ adminCode }: { adminCode: string }) {
  return (
    <CopyInviteLink
      inviteCode={adminCode}
      label="Copy admin unlock link (private)"
      successText="Copied — text this only to yourself"
    />
  );
}
