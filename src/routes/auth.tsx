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
      setMessage(error ? error.message : "تم إنشاء الحساب. تحقق من بريدك الإلكتروني.");
    } else {
      const { error } = await supabase.auth.signInWithPassword({ email, password });
      if (error) setMessage(error.message);
      else navigate({ to: "/dashboard", replace: true });
    }
    setBusy(false);
  }

  return (
    <div>
      <form onSubmit={onSubmit}>
        <input
          type="email"
          value={email}
          onChange={(e) => setEmail(e.target.value)}
          placeholder="البريد الإلكتروني"
          required
        />
        <input
          type="password"
          value={password}
          onChange={(e) => setPassword(e.target.value)}
          placeholder="كلمة المرور"
          required
        />
        <button type="submit" disabled={busy}>
          {mode === "signin" ? "تسجيل الدخول" : "إنشاء حساب"}
        </button>
      </form>
      <button type="button" onClick={() => setMode(mode === "signin" ? "signup" : "signin")}>
        {mode === "signin" ? "إنشاء حساب جديد" : "لدي حساب بالفعل"}
      </button>
      {message ? <p>{message}</p> : null}
    </div>
  );
}
