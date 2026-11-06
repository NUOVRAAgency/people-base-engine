import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";

import { tr } from "@/lib/i18n";
export type AppRole = "admin" | "operator" | "viewer";

export const ROLE_LABELS: Record<AppRole, string> = {
  admin: tr("مدير النظام"),
  operator: tr("مشغّل"),
  viewer: tr("مشاهد"),
};

type Info = { email: string; fullName: string; role: AppRole | null };

// Shared in-memory cache: the user/role is fetched once per session, so
// navigating between pages renders instantly instead of re-querying.
let cache: Info | null = null;
let pending: Promise<Info> | null = null;

async function fetchInfo(): Promise<Info> {
  const { data } = await supabase.auth.getUser();
  const user = data.user;
  if (!user) return { email: "", fullName: "", role: null };
  const meta = user.user_metadata as Record<string, unknown> | null;
  const metaName = (meta?.["full_name"] as string | undefined)?.trim() ?? "";
  const [profileRes, rolesRes] = await Promise.all([
    metaName ? Promise.resolve({ data: null }) : supabase.from("users").select("full_name").eq("id", user.id).maybeSingle(),
    supabase.from("user_roles").select("role").eq("user_id", user.id),
  ]);
  const name = metaName || ((profileRes.data as { full_name?: string } | null)?.full_name?.trim() ?? "");
  const list = (rolesRes.data ?? []).map((r) => r.role as AppRole);
  return { email: user.email ?? "", fullName: name, role: list.includes("admin") ? "admin" : (list[0] ?? "viewer") };
}

if (typeof window !== "undefined") {
  supabase.auth.onAuthStateChange((event) => {
    if (event === "SIGNED_IN" || event === "SIGNED_OUT" || event === "USER_UPDATED") {
      cache = null;
      pending = null;
    }
  });
}

export function useCurrentUser() {
  const [info, setInfo] = useState<Info | null>(cache);

  useEffect(() => {
    if (cache) {
      setInfo(cache);
      return;
    }
    let mounted = true;
    pending ??= fetchInfo().then((v) => {
      cache = v;
      return v;
    });
    pending.then((v) => mounted && setInfo(v)).catch(() => {
      pending = null;
      if (mounted) setInfo({ email: "", fullName: "", role: null });
    });
    return () => {
      mounted = false;
    };
  }, []);

  const email = info?.email ?? "";
  const fullName = info?.fullName ?? "";
  const role = info?.role ?? null;
  const initials = (fullName || email || tr("؟")).trim().slice(0, 2).toUpperCase();

  return { email, fullName, role, initials, loading: info === null, isAdmin: role === "admin" };
}
