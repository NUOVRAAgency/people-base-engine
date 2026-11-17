import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import {
  Outlet,
  Link,
  createRootRouteWithContext,
  useRouter,
  HeadContent,
  Scripts,
} from "@tanstack/react-router";
import { useEffect, type ReactNode } from "react";

import appCss from "../styles.css?url";
import { Toaster } from "@/components/ui/sonner";
import { supabase } from "@/integrations/supabase/client";

import { DirectionProvider } from "@radix-ui/react-direction";
import { tr, getDirection, LANGUAGE_BOOT_SCRIPT } from "@/lib/i18n";
function NotFoundComponent() {
  return (
    <div className="flex min-h-screen items-center justify-center bg-background px-4">
      <div className="max-w-md text-center">
        <h1 className="text-7xl font-bold text-foreground">404</h1>
        <h2 className="mt-4 text-xl font-semibold text-foreground">Page not found</h2>
        <p className="mt-2 text-sm text-muted-foreground">
          The page you're looking for doesn't exist or has been moved.
        </p>
        <div className="mt-6">
          <Link
            to="/"
            className="inline-flex items-center justify-center rounded-md bg-primary px-4 py-2 text-sm font-medium text-primary-foreground transition-colors hover:bg-primary/90"
          >
            Go home
          </Link>
        </div>
      </div>
    </div>
  );
}

function ErrorComponent({ error, reset }: { error: Error; reset: () => void }) {
  console.error(error);
  const router = useRouter();

  useEffect(() => {
    if (typeof window === "undefined" || !navigator.onLine || !error.message.includes("Failed to fetch dynamically imported module")) return;

    const retryKey = "dynamic-import-retry";
    const previousRetry = window.sessionStorage.getItem(retryKey);
    if (previousRetry === window.location.pathname) {
      window.sessionStorage.removeItem(retryKey);
      return;
    }

    window.sessionStorage.setItem(retryKey, window.location.pathname);
    void (async () => {
      if ("serviceWorker" in navigator) {
        const registrations = await navigator.serviceWorker.getRegistrations();
        await Promise.all(registrations.map((registration) => registration.unregister()));
      }
      if ("caches" in window) {
        const cacheNames = await caches.keys();
        await Promise.all(cacheNames.map((cacheName) => caches.delete(cacheName)));
      }
      window.location.reload();
    })();
  }, [error]);

  return (
    <div className="flex min-h-screen items-center justify-center bg-background px-4">
      <div className="max-w-md text-center">
        <h1 className="text-xl font-semibold tracking-tight text-foreground">
          This page didn't load
        </h1>
        <p className="mt-2 text-sm text-muted-foreground">
          Something went wrong on our end. You can try refreshing or head back home.
        </p>
        <div className="mt-6 flex flex-wrap justify-center gap-2">
          <button
            onClick={() => {
              router.invalidate();
              reset();
            }}
            className="inline-flex items-center justify-center rounded-md bg-primary px-4 py-2 text-sm font-medium text-primary-foreground transition-colors hover:bg-primary/90"
          >
            Try again
          </button>
          <a
            href="/"
            className="inline-flex items-center justify-center rounded-md border border-input bg-background px-4 py-2 text-sm font-medium text-foreground transition-colors hover:bg-accent"
          >
            Go home
          </a>
        </div>
      </div>
    </div>
  );
}

export const Route = createRootRouteWithContext<{ queryClient: QueryClient }>()({
  head: () => ({
    meta: [
      { charSet: "utf-8" },
      { name: "viewport", content: "width=device-width, initial-scale=1" },
      { title: "Smart HR" },
      { name: "apple-mobile-web-app-title", content: "Smart HR" },
      { name: "application-name", content: "Smart HR" },
      { name: "description", content: tr("نظام إدارة الموارد البشرية") },
      { name: "theme-color", content: "#ffffff" },
      { property: "og:title", content: "Smart HR" },
      { property: "og:description", content: tr("نظام إدارة الموارد البشرية") },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary_large_image" },
    ],
    links: [
      {
        rel: "preconnect",
        href: "https://fonts.googleapis.com",
      },
      {
        rel: "preconnect",
        href: "https://fonts.gstatic.com",
        crossOrigin: "anonymous",
      },
      {
        rel: "stylesheet",
        href: "https://fonts.googleapis.com/css2?family=IBM+Plex+Sans+Arabic:wght@400;500;600;700&display=swap",
      },
      {
        rel: "stylesheet",
        href: appCss,
      },
      { rel: "icon", href: "/favicon.png", type: "image/png" },
      { rel: "apple-touch-icon", href: "/apple-touch-icon.png" },
      { rel: "manifest", href: "/manifest.json?v=3" },
    ],
  }),
  shellComponent: RootShell,
  component: RootComponent,
  notFoundComponent: NotFoundComponent,
  errorComponent: (props) => (
    <ErrorComponent
      error={props.error instanceof Error ? props.error : new Error(String(props.error))}
      reset={props.reset}
    />
  ),
});

function RootShell({ children }: { children: ReactNode }) {
  return (
    <html lang="ar">
      <head>
        <HeadContent />
        {/* Boot-time recovery: if the app's entry module fails to load (e.g. the dev
            server was restarting), reload once instead of leaving a blank screen. */}
        <script
          dangerouslySetInnerHTML={{
            __html: `(function(){var k="boot-import-retry";function h(m){if(!m||String(m).indexOf("dynamically imported module")<0)return;if(sessionStorage.getItem(k))return;sessionStorage.setItem(k,"1");setTimeout(function(){location.reload()},800)}addEventListener("error",function(e){h(e.message)});addEventListener("unhandledrejection",function(e){h(e.reason&&e.reason.message)});addEventListener("load",function(){setTimeout(function(){sessionStorage.removeItem(k)},5000)})})();`,
          }}
        />
      </head>
      <body>
        {children}
        <Scripts />
      </body>
    </html>
  );
}

function RootComponent() {
  const { queryClient } = Route.useRouteContext();
  const router = useRouter();

  // PWA: تسجيل خدمة التخزين المؤقت لقشرة التطبيق (في الإنتاج فقط)
  useEffect(() => {
    if (typeof window === "undefined" || !("serviceWorker" in navigator)) return;
    if (import.meta.env.DEV) {
      // أثناء التطوير: إلغاء أي نسخة قديمة مخزّنة تسبب شاشة بيضاء
      navigator.serviceWorker.getRegistrations().then((rs) => rs.forEach((r) => r.unregister()));
      if ("caches" in window) caches.keys().then((ks) => ks.forEach((k) => caches.delete(k)));
      return;
    }
    navigator.serviceWorker.register(`/sw.js?sb=${encodeURIComponent(new URL(import.meta.env["VITE_SUPABASE_URL"] as string).origin)}`).catch(() => {});
  }, []);

  useEffect(() => {
    document.documentElement.dir = getDirection();
    document.documentElement.lang = getDirection() === "ltr" ? "en" : "ar";
  }, []);

  // تحديث حالة الجلسة عند تسجيل الدخول أو الخروج
  useEffect(() => {
    const { data } = supabase.auth.onAuthStateChange((event) => {
      if (event !== "SIGNED_IN" && event !== "SIGNED_OUT" && event !== "USER_UPDATED") return;
      router.invalidate();
      if (event !== "SIGNED_OUT") queryClient.invalidateQueries();
    });
    return () => data.subscription.unsubscribe();
  }, [router, queryClient]);

  return (
    <QueryClientProvider client={queryClient}>
      {/* Required: nested routes render here. Removing <Outlet /> breaks all child routes. */}
      <DirectionProvider dir={getDirection()}>
        <Outlet />
        <Toaster position="top-center" richColors dir={getDirection()} />
      </DirectionProvider>
    </QueryClientProvider>
  );
}
