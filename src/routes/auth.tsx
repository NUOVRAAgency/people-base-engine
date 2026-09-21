import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";

export const Route = createFileRoute("/auth")({
  ssr: false,
  head: () => ({
    meta: [
      { title: "تسجيل الدخول | HR System" },
      { name: "description", content: "تسجيل الدخول إلى نظام إدارة الموارد البشرية" },
      { property: "og:title", content: "تسجيل الدخول | HR System" },
      { property: "og:description", content: "تسجيل الدخول إلى نظام إدارة الموارد البشرية" },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary_large_image" },
    ],
  }),
  component: AuthPage,
});

function AuthPage() {
  const navigate = useNavigate();
  const [mode, setMode] = useState<"signin" | "signup">("signin");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [message, setMessage] = useState("");
  const [messageType, setMessageType] = useState<"error" | "success">("error");
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    supabase.auth.getSession().then(({ data }) => {
      if (data.session) navigate({ to: "/dashboard", replace: true });
    });
  }, [navigate]);

  async function onSubmit(e: React.FormEvent) {
    e.preventDefault();
    setBusy(true);
    setMessage("");
    if (mode === "signup") {
      const { error } = await supabase.auth.signUp({
        email,
        password,
        options: { emailRedirectTo: `${window.location.origin}/dashboard` },
      });
      if (error) {
        setMessageType("error");
        setMessage(error.message);
      } else {
        setMessageType("success");
        setMessage("تم إنشاء الحساب. تحقق من بريدك الإلكتروني.");
      }
    } else {
      const { error } = await supabase.auth.signInWithPassword({ email, password });
      if (error) {
        setMessageType("error");
        setMessage(error.message);
      } else {
        navigate({ to: "/dashboard", replace: true });
      }
    }
    setBusy(false);
  }

  return (
    <div className="relative flex min-h-screen items-center justify-center overflow-hidden bg-background px-4 py-10">
      {/* لمسة ضوئية زرقاء ناعمة خلف البطاقة */}
      <div
        aria-hidden
        className="pointer-events-none absolute -top-40 left-1/2 h-[28rem] w-[42rem] -translate-x-1/2 rounded-full bg-primary/10 blur-3xl"
      />
      <div
        aria-hidden
        className="pointer-events-none absolute -bottom-48 right-[-8rem] h-[26rem] w-[26rem] rounded-full bg-primary/5 blur-3xl"
      />

      <div className="relative w-full max-w-md rounded-3xl border border-glass-border bg-glass p-8 shadow-glass backdrop-blur-xl sm:p-10">
        <div className="mb-8 text-center">
          <div className="mx-auto mb-5 flex h-14 w-14 items-center justify-center rounded-2xl bg-primary text-primary-foreground shadow-glass">
            <svg
              xmlns="http://www.w3.org/2000/svg"
              viewBox="0 0 24 24"
              fill="none"
              stroke="currentColor"
              strokeWidth="1.8"
              strokeLinecap="round"
              strokeLinejoin="round"
              className="h-7 w-7"
            >
              <path d="M16 21v-2a4 4 0 0 0-4-4H6a4 4 0 0 0-4 4v2" />
              <circle cx="9" cy="7" r="4" />
              <path d="M22 21v-2a4 4 0 0 0-3-3.87" />
              <path d="M16 3.13a4 4 0 0 1 0 7.75" />
            </svg>
          </div>
          <h1 className="text-xl font-bold tracking-tight text-foreground">
            نظام إدارة الموارد البشرية
          </h1>
          <p className="mt-2 text-sm text-muted-foreground">
            {mode === "signin" ? "سجّل دخولك للمتابعة" : "أنشئ حسابًا جديدًا"}
          </p>
        </div>

        <form onSubmit={onSubmit} className="space-y-5">
          <div className="space-y-2">
            <label htmlFor="email" className="block text-sm font-medium text-foreground">
              اسم المستخدم
            </label>
            <input
              id="email"
              type="email"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              placeholder="example@email.com"
              required
              dir="ltr"
              className="w-full rounded-xl border border-glass-border bg-white/60 px-4 py-3 text-sm text-foreground shadow-sm outline-none transition placeholder:text-muted-foreground/70 focus:border-primary/50 focus:ring-2 focus:ring-primary/25"
            />
          </div>

          <div className="space-y-2">
            <label htmlFor="password" className="block text-sm font-medium text-foreground">
              كلمة المرور
            </label>
            <input
              id="password"
              type="password"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              placeholder="••••••••"
              required
              dir="ltr"
              className="w-full rounded-xl border border-glass-border bg-white/60 px-4 py-3 text-sm text-foreground shadow-sm outline-none transition placeholder:text-muted-foreground/70 focus:border-primary/50 focus:ring-2 focus:ring-primary/25"
            />
          </div>

          <button
            type="submit"
            disabled={busy}
            className="w-full rounded-xl bg-primary px-4 py-3 text-sm font-semibold text-primary-foreground shadow-glass transition hover:bg-primary/90 focus:outline-none focus:ring-2 focus:ring-primary/40 focus:ring-offset-2 disabled:cursor-not-allowed disabled:opacity-60"
          >
            {busy ? "جارٍ المعالجة..." : mode === "signin" ? "دخول" : "إنشاء حساب"}
          </button>
        </form>

        {message ? (
          <p
            className={
              messageType === "error"
                ? "mt-5 rounded-xl bg-destructive/10 px-4 py-3 text-center text-sm text-destructive"
                : "mt-5 rounded-xl bg-primary/10 px-4 py-3 text-center text-sm text-primary"
            }
          >
            {message}
          </p>
        ) : null}

        <button
          type="button"
          onClick={() => {
            setMode(mode === "signin" ? "signup" : "signin");
            setMessage("");
          }}
          className="mt-6 w-full text-center text-sm font-medium text-primary underline-offset-4 transition hover:underline"
        >
          {mode === "signin" ? "إنشاء حساب جديد" : "لدي حساب بالفعل"}
        </button>
      </div>
    </div>
  );
}
