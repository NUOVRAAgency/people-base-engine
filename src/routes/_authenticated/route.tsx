import { loadCurrency } from "@/lib/currency";
import { createFileRoute, Outlet, useLocation, useNavigate } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { MobileShell } from "@/components/mobile-shell";
import { isOfflineAuthed } from "@/lib/offline-login";

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

    const check = navigator.onLine
      ? supabase.auth.getUser().then(({ data, error }) => ({ ok: !error && !!data.user }))
      : supabase.auth.getSession().then(({ data }) => ({ ok: !!data.session || isOfflineAuthed() }));
    check.then(async ({ ok }) => {
      if (!isMounted) return;
      if (!ok) {
        navigate({ to: "/auth", replace: true });
        return;
      }
      if (navigator.onLine) {
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
