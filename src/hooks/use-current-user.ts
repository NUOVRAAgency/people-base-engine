import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";

export type AppRole = "admin" | "operator" | "viewer";

export const ROLE_LABELS: Record<AppRole, string> = {
  admin: "مدير النظام",
  operator: "مشغّل",
  viewer: "مشاهد",
};

export function useCurrentUser() {
  const [email, setEmail] = useState<string>("");
  const [fullName, setFullName] = useState<string>("");
  const [role, setRole] = useState<AppRole | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    let mounted = true;

    (async () => {
      const { data } = await supabase.auth.getUser();
      const user = data.user;
      if (!mounted) return;
      if (!user) {
        setLoading(false);
        return;
      }
      setEmail(user.email ?? "");
      const meta = user.user_metadata as Record<string, unknown> | null;
      let name = (meta?.["full_name"] as string | undefined)?.trim() ?? "";
      if (!name) {
        const { data: profile } = await supabase
          .from("users")
          .select("full_name")
          .eq("id", user.id)
          .maybeSingle();
        name = (profile?.full_name as string | undefined)?.trim() ?? "";
      }
      setFullName(name);

      const { data: roles } = await supabase
        .from("user_roles")
        .select("role")
        .eq("user_id", user.id);
      if (!mounted) return;
      const list = (roles ?? []).map((r) => r.role as AppRole);
      setRole(list.includes("admin") ? "admin" : (list[0] ?? "viewer"));
      setLoading(false);
    })();

    return () => {
      mounted = false;
    };
  }, []);

  const initials = (fullName || email || "؟").trim().slice(0, 2).toUpperCase();

  return { email, fullName, role, initials, loading, isAdmin: role === "admin" };
}
