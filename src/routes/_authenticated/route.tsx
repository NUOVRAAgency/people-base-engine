import { loadCurrency } from "@/lib/currency";
import { createFileRoute, Outlet, useLocation, useNavigate } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { MobileShell } from "@/components/mobile-shell";
import { isOfflineAuthed } from "@/lib/offline-login";
import { isLocked } from "@/lib/offline";

export const Route = createFileRoute("/_authenticated")({
  component: AuthenticatedLayout,
});

function AuthenticatedLayout() {
  const navigate = useNavigate();
  const [isAuthenticated, setIsAuthenticated] = useState(false);
  const [mustChange, setMustChange] = useState(false);
  const pathname = useLocation({ select: (l) => l.pathname });

  useEffect(() => {
    let isMounted = true;

    // Offline sign-in wins; otherwise ask the server, and if it can't be reached use the saved session.
    const check: Promise<{ ok: boolean }> = isOfflineAuthed()
      ? Promise.resolve({ ok: true })
      : supabase.auth.getUser().then(async ({ data, error }) => {
          if (!error && data.user) return { ok: true };
          if (error && !error.status) {
            const { data: s } = await supabase.auth.getSession();
            return { ok: !!s.session };
          }
          return { ok: false };
        }).catch(() => ({ ok: false }));
    check.then(async ({ ok }) => {
      if (!isMounted) return;
      if (!ok || (isLocked() && !isOfflineAuthed())) {
        navigate({ to: "/auth", replace: true });
        return;
      }
      if (navigator.onLine && !isOfflineAuthed()) {
        const { data: u } = await supabase.auth.getUser();
        const { data: profile } = u.user
          ? await supabase.from("users").select("must_change_password").eq("id", u.user.id).maybeSingle()
          : { data: null };
        if (isMounted) setMustChange(!!profile?.must_change_password);
      }
      await loadCurrency().catch(() => {});
      if (!isMounted) return;
      setIsAuthenticated(true);
    });

    return () => {
      isMounted = false;
    };
  }, [navigate]);

  // Forced first-login password change: no section is reachable until it is done.
  useEffect(() => {
    if (isAuthenticated && mustChange && pathname !== "/account") navigate({ to: "/account", replace: true });
  }, [isAuthenticated, mustChange, pathname, navigate]);

  if (!isAuthenticated || (mustChange && pathname !== "/account")) {
    return <div className="min-h-screen bg-background" aria-busy="true" />;
  }

  return (
    <MobileShell>
      <Outlet />
    </MobileShell>
  );
}
