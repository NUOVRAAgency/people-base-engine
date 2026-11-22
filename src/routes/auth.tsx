import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { Eye, EyeOff, LoaderCircle, UsersRound } from "lucide-react";
import { useEffect, useState } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { supabase } from "@/integrations/supabase/client";
import { getLanguage, setLanguage, tr } from "@/lib/i18n";
import { isLocked, LOCK_KEY } from "@/lib/offline";
import { checkOfflineLogin, OFFLINE_FLAG, rememberOfflineLogin } from "@/lib/offline-login";

export const Route = createFileRoute("/auth")({
  ssr: false,
  head: () => ({
    meta: [
      { title: tr("تسجيل الدخول | نظام الموارد البشرية") },
      { name: "description", content: tr("الدخول الآمن إلى مساحة عمل الموارد البشرية") },
      { property: "og:title", content: tr("تسجيل الدخول | نظام الموارد البشرية") },
      { property: "og:description", content: tr("الدخول الآمن إلى مساحة عمل الموارد البشرية") },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary_large_image" },
    ],
  }),
  component: AuthPage,
});

function AuthPage() {
  const navigate = useNavigate();
  const language = getLanguage();
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [showPassword, setShowPassword] = useState(false);
  const [message, setMessage] = useState("");
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    supabase.auth.getSession().then(({ data }) => {
      if (data.session && !isLocked()) navigate({ to: "/dashboard", replace: true });
    });
  }, [navigate]);

  async function onSubmit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setBusy(true);
    setMessage("");
    const offlineTry = async () => {
      const { data } = await supabase.auth.getSession().catch(() => ({ data: { session: null } }));
      if (data.session && (await checkOfflineLogin(email, password))) {
        localStorage.setItem(OFFLINE_FLAG, "1");
        localStorage.removeItem(LOCK_KEY);
        navigate({ to: "/dashboard", replace: true });
        return;
      }
      setMessage(tr("لا يوجد اتصال. الدخول بدون إنترنت متاح فقط لمن سجّل دخوله سابقاً على هذا الجهاز"));
    };
    if (!navigator.onLine) {
      await offlineTry();
      setBusy(false);
      return;
    }
    const { error } = await supabase.auth.signInWithPassword({ email, password });
    // No real answer from the server (no internet, Wi-Fi without internet, timeout) -> check locally.
    const noServer = error && (!error.status || error.name === "AuthRetryableFetchError" || /fetch|network/i.test(error.message) || !navigator.onLine);
    if (noServer) await offlineTry();
    else if (error) setMessage(tr("تعذر تسجيل الدخول، تحقق من البيانات"));
    else {
      localStorage.removeItem(LOCK_KEY);
      localStorage.removeItem(OFFLINE_FLAG);
      await rememberOfflineLogin(email, password).catch(() => {});
      navigate({ to: "/dashboard", replace: true });
    }
    setBusy(false);
  }

  return (
    <main className="relative grid min-h-dvh place-items-center overflow-hidden bg-page px-4 py-8 sm:px-6">
      <div className="pointer-events-none absolute inset-0 bg-login-pattern opacity-70" aria-hidden />
      <div className="relative w-full max-w-[360px] overflow-hidden rounded-2xl border border-primary/15 bg-card shadow-login sm:max-w-[390px] md:max-w-[760px]">
        <div className="h-2 [background:var(--header-gradient)]" aria-hidden />
        <div className="p-6 sm:p-8 md:grid md:grid-cols-2 md:items-center md:gap-10 md:self-center md:px-10 md:py-7">
          <header className="mb-6 text-center md:mb-0 md:border-e md:border-primary/15 md:pe-10">
            <span className="mx-auto mb-3 flex size-12 items-center justify-center rounded-2xl bg-primary/10 text-primary">
              <UsersRound className="size-6" aria-hidden />
            </span>
            <h1 className="text-xl font-semibold text-primary md:text-2xl">{tr("نظام الموارد البشرية")}</h1>
            <p className="mt-1 text-[11px] font-medium text-primary md:text-xs">{tr("إدارة فريقك تبدأ من هنا")}</p>
            <div className="mt-6 hidden items-center justify-center gap-3 text-[11px] font-semibold md:flex">
              <Button type="button" variant="ghost" size="sm" className={language === "en" ? "text-primary" : "text-primary/60"} onClick={() => setLanguage("en")}>English</Button>
              <span className="h-3 w-px bg-primary/30" aria-hidden />
              <Button type="button" variant="ghost" size="sm" className={language === "ar" ? "text-primary" : "text-primary/60"} onClick={() => setLanguage("ar")}>العربية</Button>
            </div>
          </header>

          <form className="space-y-4 md:space-y-3" onSubmit={onSubmit}>
            <label className="block space-y-1.5">
              <span className="block text-xs font-semibold text-primary">{tr("اسم المستخدم")}</span>
              <Input type="email" value={email} onChange={(event) => setEmail(event.target.value)} required autoComplete="username" inputMode="email" dir="ltr" className="h-11 rounded-xl border-primary/25 bg-primary/5 text-start text-sm text-foreground placeholder:text-primary/45 focus-visible:border-primary focus-visible:ring-primary/20 md:h-10" placeholder="name@company.com" />
            </label>

            <label className="block space-y-1.5">
              <span className="block text-xs font-semibold text-primary">{tr("كلمة المرور")}</span>
              <span className="relative block">
                <Input type={showPassword ? "text" : "password"} value={password} onChange={(event) => setPassword(event.target.value)} required autoComplete="current-password" dir="ltr" className="h-11 rounded-xl border-primary/25 bg-primary/5 pr-16 pl-4 text-left text-sm text-foreground placeholder:text-primary/45 focus-visible:border-primary focus-visible:ring-primary/20 md:h-10" placeholder="••••••••" />
                <Button type="button" variant="ghost" size="icon" className="absolute right-1 top-1 size-9 rounded-lg text-primary hover:bg-primary/10 hover:text-primary md:top-0.5" onClick={() => setShowPassword((value) => !value)} aria-label={showPassword ? tr("إخفاء كلمة المرور") : tr("إظهار كلمة المرور")}>
                  {showPassword ? <EyeOff aria-hidden /> : <Eye aria-hidden />}
                </Button>
              </span>
            </label>

            <div className="flex justify-end">
              <button type="button" className="text-xs font-semibold text-primary underline-offset-4 hover:underline" onClick={() => setMessage(tr("تواصل مع مدير النظام لإعادة تعيين كلمة المرور"))}>
                {tr("نسيت كلمة المرور؟")}
              </button>
            </div>

            {message ? <p role="alert" className="rounded-lg border border-destructive/20 bg-destructive/5 px-3 py-2 text-center text-xs text-destructive">{message}</p> : null}

            <div className="flex justify-center pt-2 md:pt-1">
              <Button type="submit" className="h-10 min-w-32 rounded-xl px-8 font-semibold text-primary-foreground shadow-sm [background:var(--header-gradient)] hover:opacity-95 md:w-full" disabled={busy}>
                {busy ? <LoaderCircle className="animate-spin" aria-hidden /> : null}
                {busy ? tr("جارٍ الدخول...") : tr("دخول")}
              </Button>
            </div>
          </form>

          <div className="mt-6 flex items-center justify-center gap-3 border-t border-primary/15 pt-4 text-[11px] font-semibold md:hidden">
            <Button type="button" variant="ghost" size="sm" className={language === "en" ? "text-primary" : "text-primary/60"} onClick={() => setLanguage("en")}>English</Button>
            <span className="h-3 w-px bg-primary/30" aria-hidden />
            <Button type="button" variant="ghost" size="sm" className={language === "ar" ? "text-primary" : "text-primary/60"} onClick={() => setLanguage("ar")}>العربية</Button>
          </div>
        </div>
      </div>
    </main>
  );
}
