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
    <main className="min-h-dvh bg-white p-4" dir="rtl">
      <form onSubmit={onSubmit}>
        <input
          type="email"
          value={email}
          onChange={(event) => setEmail(event.target.value)}
          placeholder="اسم المستخدم"
          autoComplete="username"
          required
        />
        <input
          type="password"
          value={password}
          onChange={(event) => setPassword(event.target.value)}
          placeholder="كلمة المرور"
          autoComplete="current-password"
          required
        />
        {message ? <p role="alert">{message}</p> : null}
        <button type="submit" disabled={busy}>
          {busy ? "..." : "دخول"}
        </button>
      </form>
    </main>
  );
}
