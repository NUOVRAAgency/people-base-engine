import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { LoaderCircle } from "lucide-react";
import { useEffect } from "react";

import { supabase } from "@/integrations/supabase/client";
import { tr } from "@/lib/i18n";
import { isOfflineAuthed } from "@/lib/offline-login";
import { isLocked } from "@/lib/offline";
export const Route = createFileRoute("/")({
  head: () => ({ meta: [{ title: tr("نظام الموارد البشرية الذكي") }, { name: "description", content: tr("نظام إدارة الموارد البشرية") }, { property: "og:title", content: tr("نظام الموارد البشرية الذكي") }, { property: "og:description", content: tr("نظام إدارة الموارد البشرية") }, { property: "og:type", content: "website" }, { name: "twitter:card", content: "summary_large_image" }] }),
  component: Index,
});

function Index() {
  const navigate = useNavigate();

  useEffect(() => {
    if (isOfflineAuthed() && !isLocked()) {
      navigate({ to: "/dashboard", replace: true });
      return;
    }
    supabase.auth.getSession().then(({ data }) => {
      navigate({ to: data.session && !isLocked() ? "/dashboard" : "/auth", replace: true });
    }).catch(() => navigate({ to: "/auth", replace: true }));
  }, [navigate]);

  return (
    <main className="grid min-h-dvh place-items-center bg-page" aria-busy="true">
      <LoaderCircle className="size-5 animate-spin text-primary" aria-label={tr("جاري التحميل")} />
    </main>
  );
}
