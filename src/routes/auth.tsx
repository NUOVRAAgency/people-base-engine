import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { LockKeyhole, Mail } from "lucide-react";
import { useEffect, useState } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
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
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [message, setMessage] = useState("");
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
    const { error } = await supabase.auth.signInWithPassword({ email, password });
    if (error) setMessage(error.message);
    else navigate({ to: "/dashboard", replace: true });
    setBusy(false);
  }

  return (
    <main className="flex min-h-dvh items-center justify-center bg-background px-5 py-8" dir="rtl">
      <section className="relative w-full max-w-[25rem] overflow-hidden rounded-[2rem] border border-border/70 bg-glass px-6 pb-8 pt-10 shadow-login backdrop-blur-2xl sm:max-w-[28rem] sm:px-10 sm:pb-10 sm:pt-12">
        <div className="absolute inset-x-0 top-0 h-2.5 bg-primary" aria-hidden="true" />

        <form onSubmit={onSubmit} className="space-y-6">
          <div className="space-y-2.5">
            <label htmlFor="email" className="block text-base font-semibold text-foreground">
              اسم المستخدم
            </label>
            <div className="relative">
              <Input
                id="email"
                type="email"
                value={email}
                onChange={(event) => setEmail(event.target.value)}
                placeholder="أدخل اسم المستخدم"
                autoComplete="username"
                required
                dir="rtl"
                className="h-14 rounded-2xl border-border/90 bg-background/65 pe-4 ps-12 text-base shadow-none placeholder:text-muted-foreground/70 focus-visible:border-primary focus-visible:ring-2 focus-visible:ring-primary/15"
              />
              <Mail className="pointer-events-none absolute start-4 top-1/2 size-5 -translate-y-1/2 text-muted-foreground" aria-hidden="true" />
            </div>
          </div>

          <div className="space-y-2.5">
            <label htmlFor="password" className="block text-base font-semibold text-foreground">
              كلمة المرور
            </label>
            <div className="relative">
              <Input
                id="password"
                type="password"
                value={password}
                onChange={(event) => setPassword(event.target.value)}
                placeholder="أدخل كلمة المرور"
                autoComplete="current-password"
                required
                dir="rtl"
                className="h-14 rounded-2xl border-border/90 bg-background/65 pe-4 ps-12 text-base shadow-none placeholder:text-muted-foreground/70 focus-visible:border-primary focus-visible:ring-2 focus-visible:ring-primary/15"
              />
              <LockKeyhole className="pointer-events-none absolute start-4 top-1/2 size-5 -translate-y-1/2 text-muted-foreground" aria-hidden="true" />
            </div>
          </div>

          {message ? (
            <p role="alert" className="text-center text-sm text-destructive">
              {message}
            </p>
          ) : null}

          <Button
            type="submit"
            size="lg"
            disabled={busy}
            className="h-14 w-full rounded-2xl text-base font-bold shadow-nav transition-transform hover:-translate-y-0.5"
          >
            {busy ? "جارٍ الدخول..." : "دخول"}
          </Button>
        </form>
      </section>
    </main>
  );
}
