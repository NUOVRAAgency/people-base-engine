import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { UsersRound } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";

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
      <div aria-hidden className="absolute inset-0 bg-login-pattern opacity-50" />
      <div className="relative w-full max-w-md rounded-lg border border-glass-border bg-glass p-8 shadow-login backdrop-blur-xl sm:p-10">
        <div className="mb-8 text-center">
          <div className="mx-auto mb-5 grid h-14 w-14 place-items-center rounded-lg bg-primary text-primary-foreground shadow-glass">
            <UsersRound className="h-7 w-7" aria-hidden="true" />
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
            <Label htmlFor="email" className="block text-sm font-medium text-foreground">
              اسم المستخدم
            </Label>
            <Input
              id="email"
              type="email"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              placeholder="example@email.com"
              required
              dir="ltr"
              className="h-12 rounded-lg border-glass-border bg-card/65 px-4 text-sm shadow-sm focus-visible:ring-primary/30"
            />
          </div>

          <div className="space-y-2">
            <Label htmlFor="password" className="block text-sm font-medium text-foreground">
              كلمة المرور
            </Label>
            <Input
              id="password"
              type="password"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              placeholder="••••••••"
              required
              dir="ltr"
              className="h-12 rounded-lg border-glass-border bg-card/65 px-4 text-sm shadow-sm focus-visible:ring-primary/30"
            />
          </div>

          <Button
            type="submit"
            disabled={busy}
            className="h-12 w-full rounded-lg text-sm font-semibold shadow-glass"
          >
            {busy ? "جارٍ المعالجة..." : mode === "signin" ? "دخول" : "إنشاء حساب"}
          </Button>
        </form>

        {message ? (
          <p
            className={
              messageType === "error"
                ? "mt-5 rounded-lg bg-destructive/10 px-4 py-3 text-center text-sm text-destructive"
                : "mt-5 rounded-lg bg-primary/10 px-4 py-3 text-center text-sm text-primary"
            }
          >
            {message}
          </p>
        ) : null}

        <Button
          type="button"
          onClick={() => {
            setMode(mode === "signin" ? "signup" : "signin");
            setMessage("");
          }}
          variant="link"
          className="mt-4 w-full text-center text-sm font-medium"
        >
          {mode === "signin" ? "إنشاء حساب جديد" : "لدي حساب بالفعل"}
        </Button>
      </div>
    </div>
  );
}
