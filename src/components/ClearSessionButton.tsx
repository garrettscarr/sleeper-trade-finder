"use client";

import { useRouter } from "next/navigation";

export function ClearSessionButton() {
  const router = useRouter();

  return (
    <button
      className="btn btn-secondary"
      type="button"
      onClick={async () => {
        await fetch("/api/session", { method: "DELETE" });
        router.push("/");
        router.refresh();
      }}
    >
      Clear session
    </button>
  );
}
