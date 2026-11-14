// Production-only service worker.
// - App shell: network first, cached copy when offline.
// - Read-only offline data: GET responses for an allow-list of tables are cached
//   for 7 days. Payroll, adjustments, loans and saved reports are NEVER cached.
// - No queued writes: anything other than GET always goes straight to the network.
const SHELL_CACHE = "hr-shell-v6";
const DATA_CACHE = "hr-data-v1";
const MAX_AGE_MS = 7 * 24 * 60 * 60 * 1000;
const SHELL = ["/", "/auth", "/dashboard", "/favicon.png", "/manifest.json"];
const ALLOWED_TABLES = ["employees", "attendance", "leave_requests", "branches", "app_settings", "users", "user_roles", "absence_decision_log"];
const SUPABASE_ORIGIN = new URL(self.location.href).searchParams.get("sb") || "";

self.addEventListener("install", (event) => {
  event.waitUntil(caches.open(SHELL_CACHE).then((c) => Promise.allSettled(SHELL.map((u) => fetch(u).then((r) => r.ok && c.put(u, clean(r)))))).then(() => self.skipWaiting()));
});

self.addEventListener("activate", (event) => {
  event.waitUntil(
    caches
      .keys()
      .then((keys) => Promise.all(keys.filter((k) => k !== SHELL_CACHE && k !== DATA_CACHE).map((k) => caches.delete(k))))
      .then(() => self.clients.claim()),
  );
});

self.addEventListener("message", (event) => {
  if (event.data === "clear-data") event.waitUntil(caches.delete(DATA_CACHE));
});

// Redirected responses cannot answer navigations; store a fresh copy.
function clean(res) {
  return new Response(res.body, { status: res.status, statusText: res.statusText, headers: res.headers });
}

function dataTable(url) {
  if (!SUPABASE_ORIGIN || url.origin !== SUPABASE_ORIGIN) return null;
  const m = url.pathname.match(/^\/rest\/v1\/([a-z_]+)$/);
  return m && ALLOWED_TABLES.includes(m[1]) ? m[1] : null;
}

async function networkFirstData(req) {
  const cache = await caches.open(DATA_CACHE);
  // Key includes the user token so one account never sees another account's cache.
  const auth = req.headers.get("authorization") || "";
  const key = new Request(req.url + (req.url.includes("?") ? "&" : "?") + "__u=" + encodeURIComponent(auth.slice(-24)));
  try {
    const res = await fetch(req);
    if (res.ok) {
      const body = await res.clone().blob();
      const headers = new Headers(res.headers);
      headers.set("x-hr-cached-at", String(Date.now()));
      await cache.put(key, new Response(body, { status: res.status, headers }));
    }
    return res;
  } catch (err) {
    const cached = await cache.match(key);
    if (cached && Date.now() - Number(cached.headers.get("x-hr-cached-at") || 0) < MAX_AGE_MS) return cached;
    if (cached) await cache.delete(key);
    throw err;
  }
}

self.addEventListener("fetch", (event) => {
  const req = event.request;
  if (req.method !== "GET") return;
  const url = new URL(req.url);

  if (dataTable(url)) {
    event.respondWith(networkFirstData(req));
    return;
  }

  if (
    url.origin !== self.location.origin ||
    url.pathname.startsWith("/api/") ||
    url.pathname.startsWith("/_serverFn") ||
    url.pathname.startsWith("/~oauth") ||
    url.pathname.startsWith("/payroll")
  ) {
    return;
  }

  if (req.mode === "navigate") {
    event.respondWith(
      fetch(req)
        .then((res) => {
          if (res.ok) caches.open(SHELL_CACHE).then((c) => c.put(url.pathname, clean(res.clone())));
          return res;
        })
        .catch(async () => {
          for (const k of [url.pathname, "/dashboard", "/auth", "/"]) {
            const r = await caches.match(k);
            if (r) return r;
          }
          return Response.error();
        }),
    );
    return;
  }

  event.respondWith(
    caches.match(req).then((cached) => {
      if (cached) return cached;
      return fetch(req).then((res) => {
        if (res.ok && res.type === "basic") {
          const copy = res.clone();
          caches.open(SHELL_CACHE).then((c) => c.put(req, copy));
        }
        return res;
      });
    }),
  );
});
