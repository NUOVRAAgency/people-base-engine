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
  const { fullName, role } = useCurrentUser();
  return (
    <div className="space-y-4">
      <section className="rounded-2xl border border-border/50 bg-card/75 p-5 shadow-glass backdrop-blur-sm">
        <span className="inline-flex rounded-full bg-primary/10 px-3 py-1 text-xs font-medium text-primary">
          {role ? ROLE_LABELS[role] : "—"}
        </span>
      </section>

      <Button
        variant="outline"
        className="h-11 w-full rounded-xl border-destructive/25 bg-destructive/5 text-sm font-medium text-destructive hover:bg-destructive/10 hover:text-destructive"
        onClick={async () => { await supabase.auth.signOut(); navigate({ to: "/auth", replace: true }); }}
      >
        <LogOut className="h-4 w-4" aria-hidden /> تسجيل الخروج
      </Button>
    </div>
  );
}
