import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { LogOut } from "lucide-react";
import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { ROLE_LABELS, useCurrentUser } from "@/hooks/use-current-user";
import { Button } from "@/components/ui/button";
import { getLocale, tr } from "@/lib/i18n";

export const Route = createFileRoute("/_authenticated/account")({
  head: () => ({ meta: [{ title: tr("الحساب | نظام الموارد البشرية") }, { name: "description", content: tr("بيانات حسابك وصلاحيتك في نظام الموارد البشرية") }, { property: "og:title", content: tr("الحساب | نظام الموارد البشرية") }, { property: "og:description", content: tr("بيانات حسابك وصلاحيتك في نظام الموارد البشرية") }, { property: "og:type", content: "website" }, { name: "twitter:card", content: "summary_large_image" }] }),
  component: AccountPage,
});

function AccountPage() {
  const navigate = useNavigate();
  const { role } = useCurrentUser();
  const [email, setEmail] = useState("");
  const [lastSignIn, setLastSignIn] = useState<string | null>(null);
  const [branch, setBranch] = useState<string | null>(null);

  useEffect(() => {
    void (async () => {
      const { data } = await supabase.auth.getUser();
      const user = data.user;
      if (!user) return;
      setEmail(user.email ?? "");
      setLastSignIn(user.last_sign_in_at ?? null);
      const { data: profile } = await supabase.from("users").select("branch_id").eq("id", user.id).maybeSingle();
      if (profile?.branch_id) {
        const { data: b } = await supabase.from("branches").select("name").eq("id", profile.branch_id).maybeSingle();
        setBranch(b?.name ?? null);
      }
    })();
  }, []);

  const fmt = new Intl.DateTimeFormat(getLocale(), { dateStyle: "medium", timeStyle: "short" });
  const rows = [
    { label: tr("البريد الإلكتروني"), value: email || "—", ltr: true },
    { label: tr("الدور"), value: role ? ROLE_LABELS[role] : "—" },
    { label: tr("الفرع"), value: branch ?? tr("كل الفروع / غير محدد") },
    { label: tr("آخر دخول"), value: lastSignIn ? fmt.format(new Date(lastSignIn)) : "—" },
  ];

  return (
    <div className="mx-auto w-full max-w-3xl space-y-4">
      <section className="overflow-hidden rounded-2xl border border-border/50 bg-card/75 shadow-glass backdrop-blur-sm">
        {rows.map((r, i) => (
          <div key={r.label} className={i ? "flex items-center justify-between gap-3 border-t border-border/40 px-4 py-3.5" : "flex items-center justify-between gap-3 px-4 py-3.5"}>
            <span className="text-xs text-muted-foreground">{r.label}</span>
            <span dir={r.ltr ? "ltr" : undefined} className="truncate text-sm font-medium">{r.value}</span>
          </div>
        ))}
      </section>
      <Button
        variant="outline"
        className="h-11 w-full rounded-xl border-destructive/25 bg-destructive/5 text-sm font-medium text-destructive hover:bg-destructive/10 hover:text-destructive"
        onClick={async () => { await supabase.auth.signOut(); navigate({ to: "/auth", replace: true }); }}
      >
        <LogOut className="h-4 w-4" aria-hidden /> {tr("تسجيل الخروج")}
      </Button>
    </div>
  );
}
