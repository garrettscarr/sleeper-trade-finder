"use client";

import { useRouter } from "next/navigation";
import { useEffect, useRef } from "react";
import { restoreDeviceSession } from "@/lib/restore-device";

/**
 * Runs on every page. If the session cookie is missing but this browser has a
 * saved device proof (or codes), silently unlock again.
 */
export function SessionRestore() {
  const router = useRouter();
  const tried = useRef(false);

  useEffect(() => {
    if (tried.current) return;
    tried.current = true;
    (async () => {
      const result = await restoreDeviceSession();
      if (result.ok && result.restored) {
        router.refresh();
      }
    })();
  }, [router]);

  return null;
}
