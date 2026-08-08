"use client";

import { useRouter } from "next/navigation";
import { forgetThisDevice } from "@/lib/device-storage";

export function ClearSessionButton() {
  const router = useRouter();

  return (
    <button
      className="btn btn-secondary"
      type="button"
      onClick={async () => {
        await fetch("/api/session", { method: "DELETE" });
        forgetThisDevice();
        router.push("/");
        router.refresh();
      }}
    >
      Sign out / forget device
    </button>
  );
}
