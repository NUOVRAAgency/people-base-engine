// App Shell caching: الواجهة تعمل بدون إنترنت، أما الحفظ والتعديل فيتطلبان اتصالًا فعليًا.
const CACHE = "hr-shell-v2";
const SHELL = ["/", "/manifest.json", "/favicon.ico"];

self.addEventListener("install", (event) => {
  event.waitUntil(
    caches.open(CACHE).then((cache) => cache.addAll(SHELL)).then(() => self.skipWaiting()),
  );
});

self.addEventListener("activate", (event) => {
  event.waitUntil(
    caches
      .keys()
      .then((keys) => Promise.all(keys.filter((k) => k !== CACHE).map((k) => caches.delete(k))))
      .then(() => self.clients.claim()),
  );
});

self.addEventListener("fetch", (event) => {
  const req = event.request;
  const url = new URL(req.url);

  // شبكة فقط، بدون أي تخزين محلي: كل البيانات والمصادقة.
  // أي استجابة من Supabase (نطاق خارجي) أو من وظائف الخادم لا تُخزَّن أبداً،
  // فلا يبقى على جهاز Operator/Viewer أي بيانات رواتب — والتصفية تتم في قاعدة
  // البيانات عبر RLS قبل أن تصل النتيجة إلى المتصفح أصلاً.
  if (
    req.method !== "GET" ||
    url.origin !== self.location.origin ||
    url.pathname.startsWith("/api/") ||
    url.pathname.startsWith("/_serverFn") ||
    url.pathname.startsWith("/~oauth") ||
    // ملفات التطوير غير الثابتة: تخزينها يخلط بين نسخ مختلفة ويسبب شاشة بيضاء
    url.pathname.startsWith("/node_modules/") ||
    url.pathname.startsWith("/@vite") ||
    url.pathname.startsWith("/@id/") ||
    url.pathname.startsWith("/@fs/") ||
    url.pathname.startsWith("/src/") ||
    url.search.includes("v=")
  ) {
    return;
  }

  // التنقل: شبكة أولًا مع رجوع لقشرة التطبيق عند انقطاع الاتصال
  if (req.mode === "navigate") {
    event.respondWith(
      fetch(req)
        .then((res) => {
          const copy = res.clone();
          caches.open(CACHE).then((c) => c.put("/", copy));
          return res;
        })
        .catch(() => caches.match("/").then((r) => r || Response.error())),
    );
    return;
  }

  // الأصول الثابتة: الكاش أولًا
  event.respondWith(
    caches.match(req).then((cached) => {
      if (cached) return cached;
      return fetch(req).then((res) => {
        if (res.ok && res.type === "basic") {
          const copy = res.clone();
          caches.open(CACHE).then((c) => c.put(req, copy));
        }
        return res;
      });
    }),
  );
});
