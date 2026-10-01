import { signOutAndClear } from "@/lib/offline";
import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { LogOut } from "lucide-react";
import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { ROLE_LABELS, useCurrentUser } from "@/hooks/use-current-user";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { useServerFn } from "@tanstack/react-start";
import { changeMyPassword } from "@/lib/users.functions";
import { getLocale, tr } from "@/lib/i18n";

export const Route = createFileRoute("/_authenticated/account")({
  head: () => ({ meta: [{ title: tr("الحساب | نظام الموارد البشرية") }, { name: "description", content: tr("بيانات حسابك وصلاحيتك في نظام الموارد البشرية") }, { property: "og:title", content: tr("الحساب | نظام الموارد البشرية") }, { property: "og:description", content: tr("بيانات حسابك وصلاحيتك في نظام الموارد البشرية") }, { property: "og:type", content: "website" }, { name: "twitter:card", content: "summary_large_image" }] }),
  component: AccountPage,
});

function AccountPage() {
  const navigate = useNavigate();
  const { role } = useCurrentUser();
  const [email, setEmail] = useState("");
  const [lastSignIn, setLastSignIn] = useState<string | null>(null);
  const [branch, setBranch] = useState<string | null>(null);
  const [userId, setUserId] = useState("");
  const [fullName, setFullName] = useState("");
  const [mustChange, setMustChange] = useState(false);
  const [nameMsg, setNameMsg] = useState<{ ok: boolean; text: string } | null>(null);
  const [pwMsg, setPwMsg] = useState<{ ok: boolean; text: string } | null>(null);
  const [current, setCurrent] = useState("");
  const [next1, setNext1] = useState("");
  const [next2, setNext2] = useState("");
  const [busy, setBusy] = useState(false);
  const changePw = useServerFn(changeMyPassword);

  useEffect(() => {
    void (async () => {
      const { data } = await supabase.auth.getUser();
      const user = data.user;
      if (!user) return;
      setEmail(user.email ?? "");
      setLastSignIn(user.last_sign_in_at ?? null);
      setUserId(user.id);
      const { data: profile } = await supabase.from("users").select("branch_id,full_name,must_change_password").eq("id", user.id).maybeSingle();
      setFullName(profile?.full_name ?? "");
      setMustChange(!!profile?.must_change_password);
      if (profile?.branch_id) {
        const { data: b } = await supabase.from("branches").select("name").eq("id", profile.branch_id).maybeSingle();
        setBranch(b?.name ?? null);
      }
    })();
  }, []);

  const fmt = new Intl.DateTimeFormat(getLocale(), { dateStyle: "medium", timeStyle: "short" });
  const rows = [
    { label: tr("البريد الإلكتروني"), value: email || "—", ltr: true },
    { label: tr("الدور"), value: role ? ROLE_LABELS[role] : "—" },
    { label: tr("الفرع"), value: branch ?? tr("كل الفروع / غير محدد") },
    { label: tr("آخر دخول"), value: lastSignIn ? fmt.format(new Date(lastSignIn)) : "—" },
  ];

  async function saveName() {
    setNameMsg(null);
    const name = fullName.trim();
    if (name.length < 2 || name.length > 100) return setNameMsg({ ok: false, text: tr("أدخل اسماً من 2 إلى 100 حرف") });
    const { error } = await supabase.from("users").update({ full_name: name }).eq("id", userId);
    setNameMsg(error ? { ok: false, text: tr("تعذر حفظ التغييرات") } : { ok: true, text: tr("تم حفظ الاسم") });
  }

  async function savePassword() {
    setPwMsg(null);
    if (next1.length < 8) return setPwMsg({ ok: false, text: tr("كلمة المرور الجديدة 8 خانات على الأقل") });
    if (next1 !== next2) return setPwMsg({ ok: false, text: tr("كلمتا المرور غير متطابقتين") });
    setBusy(true);
    try {
      const res = await changePw({ data: { currentPassword: current, newPassword: next1 } });
      if (!res.ok) {
        const map: Record<string, string> = { wrong_current: "كلمة المرور الحالية غير صحيحة", same_password: "اختر كلمة مرور مختلفة عن الحالية", weak_password: "كلمة المرور ضعيفة ومعروفة، اختر كلمة أقوى" };
        setPwMsg({ ok: false, text: tr(map[res.error] ?? "تعذر تغيير كلمة المرور") });
      } else {
        setCurrent(""); setNext1(""); setNext2("");
        setPwMsg({ ok: true, text: tr("تم تغيير كلمة المرور") });
        if (mustChange) window.location.assign("/dashboard");
      }
    } catch {
      setPwMsg({ ok: false, text: tr("تعذر تغيير كلمة المرور") });
    }
    setBusy(false);
  }

  const msgCls = (ok: boolean) => ok ? "rounded-xl border border-success/25 bg-success/10 p-2.5 text-center text-xs text-success" : "rounded-xl border border-destructive/25 bg-destructive/5 p-2.5 text-center text-xs text-destructive";
  const card = "space-y-2.5 rounded-2xl border border-border/50 bg-card/75 p-4 shadow-glass backdrop-blur-sm";

  return (
    <div className="mx-auto w-full max-w-3xl space-y-4">
      {mustChange ? <p className={msgCls(false)}>{tr("يجب تغيير كلمة المرور المؤقتة قبل استخدام النظام")}</p> : null}
      <section className="overflow-hidden rounded-2xl border border-border/50 bg-card/75 shadow-glass backdrop-blur-sm">
        {rows.map((r, i) => (
          <div key={r.label} className={i ? "flex items-center justify-between gap-3 border-t border-border/40 px-4 py-3.5" : "flex items-center justify-between gap-3 px-4 py-3.5"}>
            <span className="text-xs text-muted-foreground">{r.label}</span>
            <span dir={r.ltr ? "ltr" : undefined} className="truncate text-sm font-medium">{r.value}</span>
          </div>
        ))}
      </section>
      {!mustChange ? (
        <section className={card}>
          <h3 className="text-sm font-semibold">{tr("الاسم المعروض")}</h3>
          <Input value={fullName} onChange={(e) => setFullName(e.target.value)} maxLength={100} className="h-11 rounded-xl" aria-label={tr("الاسم المعروض")} />
          {nameMsg ? <p className={msgCls(nameMsg.ok)}>{nameMsg.text}</p> : null}
          <Button className="h-11 w-full rounded-xl" onClick={() => void saveName()}>{tr("حفظ")}</Button>
        </section>
      ) : null}
      <section className={card}>
        <h3 className="text-sm font-semibold">{tr("تغيير كلمة المرور")}</h3>
        <Input dir="ltr" type="password" autoComplete="current-password" value={current} onChange={(e) => setCurrent(e.target.value)} placeholder={tr("كلمة المرور الحالية")} className="h-11 rounded-xl" />
        <Input dir="ltr" type="password" autoComplete="new-password" value={next1} onChange={(e) => setNext1(e.target.value)} placeholder={tr("كلمة المرور الجديدة")} className="h-11 rounded-xl" />
        <Input dir="ltr" type="password" autoComplete="new-password" value={next2} onChange={(e) => setNext2(e.target.value)} placeholder={tr("تأكيد كلمة المرور الجديدة")} className="h-11 rounded-xl" />
        {pwMsg ? <p className={msgCls(pwMsg.ok)}>{pwMsg.text}</p> : null}
        <Button className="h-11 w-full rounded-xl" disabled={busy} onClick={() => void savePassword()}>{tr("تغيير كلمة المرور")}</Button>
      </section>
      <Button
        variant="outline"
        className="h-11 w-full rounded-xl border-destructive/25 bg-destructive/5 text-sm font-medium text-destructive hover:bg-destructive/10 hover:text-destructive"
        onClick={async () => { await signOutAndClear(); navigate({ to: "/auth", replace: true }); }}
      >
        <LogOut className="h-4 w-4" aria-hidden /> {tr("تسجيل الخروج")}
      </Button>
    </div>
  );
}
