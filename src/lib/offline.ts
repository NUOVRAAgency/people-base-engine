import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";

export const LAST_SYNC_KEY = "hr-last-sync";

export function useOnline() {
  const [online, setOnline] = useState(true);
  useEffect(() => {
    const update = () => {
      const value = navigator.onLine;
      setOnline(value);
      document.documentElement.toggleAttribute("data-offline", !value);
      if (value) {
        try {
          localStorage.setItem(LAST_SYNC_KEY, new Date().toISOString());
        } catch {
          /* ignore */
        }
      }
    };
    update();
    window.addEventListener("online", update);
    window.addEventListener("offline", update);
    return () => {
      window.removeEventListener("online", update);
      window.removeEventListener("offline", update);
    };
  }, []);
  return online;
}

export function readLastSync(): string | null {
  try {
    return localStorage.getItem(LAST_SYNC_KEY);
  } catch {
    return null;
  }
}

/** Sign out and wipe every locally stored copy of data. */
export const LOCK_KEY = "hr-locked";
export const PROFILE_KEY = "hr-profile-cache";

export function readProfileCache<T>(): T | null {
  try { return JSON.parse(localStorage.getItem(PROFILE_KEY) || "null") as T | null; } catch { return null; }
}
export function writeProfileCache(v: unknown) {
  try { localStorage.setItem(PROFILE_KEY, JSON.stringify(v)); } catch {}
}
export function isLocked() {
  try { return localStorage.getItem(LOCK_KEY) === "1"; } catch { return false; }
}

export async function signOutAndClear() {
  try { sessionStorage.removeItem("hr-offline-auth"); } catch {}
  // Offline: lock the app locally and keep the saved copy so offline sign-in can show it again.
  if (!navigator.onLine) {
    try { localStorage.setItem(LOCK_KEY, "1"); } catch {}
    return;
  }
  try { localStorage.removeItem(LOCK_KEY); localStorage.removeItem(PROFILE_KEY); } catch {}
  try {
    navigator.serviceWorker?.controller?.postMessage("clear-data");
    if ("caches" in window) {
      const keys = await caches.keys();
      await Promise.all(keys.filter((k) => k.startsWith("hr-data")).map((k) => caches.delete(k)));
    }
    localStorage.removeItem(LAST_SYNC_KEY);
  } catch {
    /* ignore */
  }
  await supabase.auth.signOut().catch(() => supabase.auth.signOut({ scope: "local" }));
}
