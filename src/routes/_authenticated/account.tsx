import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { LogOut } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { ROLE_LABELS, useCurrentUser } from "@/hooks/use-current-user";
import { Button } from "@/components/ui/button";

export const Route = createFileRoute("/_authenticated/account")({
  head: () => ({ meta: [{ title: "الحساب | نظام الموارد البشرية" }, { name: "description", content: "بيانات حسابك وصلاحيتك في نظام الموارد البشرية" }, { property: "og:title", content: "الحساب | نظام الموارد البشرية" }, { property: "og:description", content: "بيانات حسابك وصلاحيتك في نظام الموارد البشرية" }, { property: "og:type", content: "website" }, { name: "twitter:card", content: "summary_large_image" }] }),
  component: AccountPage,
});

function AccountPage() {
  const navigate = useNavigate();
  const { email, fullName, role, initials } = useCurrentUser();
  return (
    <div className="space-y-4">
      <section className="rounded-lg bg-card p-5 shadow-sm">
        <div className="flex items-center gap-3">
          <span className="flex h-14 w-14 items-center justify-center rounded-full bg-primary/10 text-lg font-bold text-primary">{initials}</span>
          <div className="min-w-0 flex-1">
            <p className="truncate text-base font-bold text-foreground">{fullName || "مستخدم"}</p>
            <p className="truncate text-sm text-muted-foreground">{email}</p>
          </div>
        </div>
        <p className="mt-4 inline-flex rounded-full bg-primary/10 px-3 py-1 text-xs font-medium text-primary">{role ? ROLE_LABELS[role] : "—"}</p>
      </section>

      <Button variant="outline" className="w-full" onClick={async () => { await supabase.auth.signOut(); navigate({ to: "/auth", replace: true }); }}>
        <LogOut aria-hidden /> تسجيل الخروج
      </Button>
    </div>
  );
}
