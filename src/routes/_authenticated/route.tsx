import { loadCurrency } from "@/lib/currency";
import { createFileRoute, Outlet, useNavigate } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { MobileShell } from "@/components/mobile-shell";

export const Route = createFileRoute("/_authenticated")({
  component: AuthenticatedLayout,
});

function AuthenticatedLayout() {
  const navigate = useNavigate();
  const [isAuthenticated, setIsAuthenticated] = useState(false);

  useEffect(() => {
    let isMounted = true;

    const check = navigator.onLine
      ? supabase.auth.getUser().then(({ data, error }) => ({ ok: !error && !!data.user }))
      : supabase.auth.getSession().then(({ data }) => ({ ok: !!data.session }));
    check.then(async ({ ok }) => {
      if (!isMounted) return;
      if (!ok) {
        navigate({ to: "/auth", replace: true });
        return;
      }
      await loadCurrency().catch(() => {});
      if (!isMounted) return;
      setIsAuthenticated(true);
    });

    return () => {
      isMounted = false;
    };
  }, [navigate]);

  if (!isAuthenticated) {
    return <div className="min-h-screen bg-background" aria-busy="true" />;
  }

  return (
    <MobileShell>
      <Outlet />
    </MobileShell>
  );
}
