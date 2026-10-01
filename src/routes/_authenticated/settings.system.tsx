import { currencyLabel } from "@/lib/currency";
import { createFileRoute } from "@tanstack/react-router";
import { Building2, CalendarOff, Clock3, LoaderCircle, Save } from "lucide-react";
import { cn } from "@/lib/utils";
import { useEffect, useState } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { supabase } from "@/integrations/supabase/client";
import { useCurrentUser } from "@/hooks/use-current-user";

import { tr, trf } from "@/lib/i18n";
export const Route = createFileRoute("/_authenticated/settings/system")({
  head: () => ({
    meta: [
      { title: tr("إعدادات النظام | نظام الموارد البشرية") },
      { name: "description", content: tr("اسم المنشاة ومواعيد الدوام الرسمية وفترة السماح") },
      { property: "og:title", content: tr("إعدادات النظام | نظام الموارد البشرية") },
      { property: "og:description", content: tr("اسم المنشاة ومواعيد الدوام الرسمية وفترة السماح") },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary_large_image" },
    ],
  }),
  component: SystemSettingsPage,
});

const DAYS = [{d:6,l:"السبت"},{d:0,l:"الأحد"},{d:1,l:"الاثنين"},{d:2,l:"الثلاثاء"},{d:3,l:"الأربعاء"},{d:4,l:"الخميس"},{d:5,l:"الجمعة"}];

const shortTime = (value: string | null | undefined) => (value ? value.slice(0, 5) : "");

function SystemSettingsPage() {
  const { isAdmin, loading: roleLoading } = useCurrentUser();
  const [companyName, setCompanyName] = useState("");
  const [workStart, setWorkStart] = useState("08:00");
  const [workEnd, setWorkEnd] = useState("16:00");
  const [grace, setGrace] = useState("15");
  const [weekend, setWeekend] = useState<number[]>([5]);
  const [lateMinutes, setLateMinutes] = useState("0");
  const [lateFraction, setLateFraction] = useState<0.25 | 0.5>(0.25);
  const [currency, setCurrency] = useState<"YER" | "SAR" | "USD">("YER");
  const [savingRules, setSavingRules] = useState(false);
  const [loading, setLoading] = useState(true);
  const [savingCompany, setSavingCompany] = useState(false);
  const [savingHours, setSavingHours] = useState(false);
  const [feedback, setFeedback] = useState<{ kind: "success" | "error"; message: string } | null>(null);

  useEffect(() => {
    if (roleLoading) return;
    void (async () => {
      const { data } = await supabase
        .from("app_settings")
        .select("company_name,work_start,work_end,grace_minutes,weekend_days,late_rule_minutes,late_rule_fraction,currency")
        .eq("id", "organization")
        .maybeSingle();
      if (data) {
        setCompanyName(data.company_name ?? "");
        setWorkStart(shortTime(data.work_start) || "08:00");
        setWorkEnd(shortTime(data.work_end) || "16:00");
        setGrace(String(data.grace_minutes ?? 15));
        setWeekend((data.weekend_days ?? [5]).map(Number));
        setLateMinutes(String(data.late_rule_minutes ?? 0));
        setLateFraction(Number(data.late_rule_fraction) === 0.5 ? 0.5 : 0.25);
        setCurrency((data.currency as "YER" | "SAR" | "USD") ?? "YER");
      }
      setLoading(false);
    })();
  }, [roleLoading]);

  async function saveCompanyName() {
    setSavingCompany(true);
    setFeedback(null);
    const { data } = await supabase.auth.getUser();
    const { error } = await supabase
      .from("app_settings")
      .update({ company_name: companyName.trim() || null, updated_by: data.user?.id ?? null })
      .eq("id", "organization");
    setSavingCompany(false);
    if (error) {
      setFeedback({ kind: "error", message: tr("تعذر حفظ اسم المنشاة") });
      return;
    }
    window.dispatchEvent(new Event("hr-header-refresh"));
    setFeedback({ kind: "success", message: tr("تم حفظ اسم المنشاة") });
  }

  async function saveWorkHours() {
    const graceValue = Number(grace);
    if (!workStart || !workEnd || Number.isNaN(graceValue) || graceValue < 0 || graceValue > 240) {
      setFeedback({ kind: "error", message: tr("تحقق من المواعيد وفترة السماح") });
      return;
    }
    setSavingHours(true);
    setFeedback(null);
    const { data } = await supabase.auth.getUser();
    const { error } = await supabase
      .from("app_settings")
      .update({ work_start: workStart, work_end: workEnd, grace_minutes: graceValue, updated_by: data.user?.id ?? null })
      .eq("id", "organization");
    setSavingHours(false);
    if (error) {
      setFeedback({ kind: "error", message: tr("تعذر حفظ مواعيد الدوام") });
      return;
    }
    setFeedback({ kind: "success", message: tr("تم حفظ مواعيد الدوام") });
  }

  async function saveRules() {
    const minutes = Number(lateMinutes);
    if (Number.isNaN(minutes) || minutes < 0 || minutes > 600) {
      setFeedback({ kind: "error", message: tr("تحقق من قاعدة خصم التأخير") });
      return;
    }
    setSavingRules(true);
    setFeedback(null);
    const { data } = await supabase.auth.getUser();
    const { error } = await supabase
      .from("app_settings")
      .update({ weekend_days: [...weekend].sort(), late_rule_minutes: minutes, late_rule_fraction: lateFraction, currency, updated_by: data.user?.id ?? null })
      .eq("id", "organization");
    setSavingRules(false);
    setFeedback(error ? { kind: "error", message: tr("تعذر حفظ القواعد") } : { kind: "success", message: tr("تم حفظ القواعد") });
  }

  if (!roleLoading && !isAdmin) {
    return (
      <p className="rounded-2xl border border-border/50 bg-card/75 p-6 text-center text-sm leading-[1.8] text-muted-foreground shadow-glass backdrop-blur-sm">
        {tr("إعدادات النظام متاحة لمدير النظام فقط.")}
      </p>
    );
  }

  if (loading) {
    return (
      <p className="flex items-center justify-center gap-2 rounded-2xl border border-border/50 bg-card/75 p-10 text-sm text-muted-foreground shadow-glass backdrop-blur-sm">
        <LoaderCircle className="h-4 w-4 animate-spin" aria-hidden />
        {tr("جاري تحميل الإعدادات")}
      </p>
    );
  }

  return (
    <div className="mx-auto w-full max-w-3xl space-y-4 pb-6">
      {feedback ? (
        <p
          className={
            feedback.kind === "success"
              ? "rounded-xl border border-success/25 bg-success/10 p-3 text-center text-sm text-success"
              : "rounded-xl border border-destructive/25 bg-destructive/10 p-3 text-center text-sm text-destructive"
          }
        >
          {feedback.message}
        </p>
      ) : null}

      <section className="rounded-2xl border border-border/50 bg-card/75 p-4 shadow-glass backdrop-blur-sm">
        <div className="flex items-center gap-2">
          <span className="flex size-10 items-center justify-center rounded-full bg-primary/10 text-primary">
            <Building2 className="h-5 w-5" aria-hidden />
          </span>
          <div>
            <h2 className="text-sm font-semibold text-foreground">{tr("اسم المنشاة")}</h2>
            <p className="text-xs text-muted-foreground">{tr("يظهر في الهيدر ويختفي عند تركه فارغا")}</p>
          </div>
        </div>
        <Input
          dir="auto"
          value={companyName}
          onChange={(event) => setCompanyName(event.target.value)}
          maxLength={50}
          placeholder={tr("اكتب اسم المنشاة")}
          className="mt-3 h-11 rounded-xl"
        />
        <Button type="button" className="mt-3 h-11 w-full rounded-xl text-sm font-medium" disabled={savingCompany} onClick={() => void saveCompanyName()}>
          {savingCompany ? <LoaderCircle className="h-4 w-4 animate-spin" aria-hidden /> : <Save className="h-4 w-4" aria-hidden />}
          {tr("حفظ اسم المنشاة")}
        </Button>
      </section>

      <section className="rounded-2xl border border-border/50 bg-card/75 p-4 shadow-glass backdrop-blur-sm">
        <div className="flex items-center gap-2">
          <span className="flex size-10 items-center justify-center rounded-full bg-primary/10 text-primary">
            <Clock3 className="h-5 w-5" aria-hidden />
          </span>
          <div>
            <h2 className="text-sm font-semibold text-foreground">{tr("مواعيد الدوام الرسمية")}</h2>
            <p className="text-xs text-muted-foreground">{tr("تعتمد عليها شاشة الحضور في حساب التاخير")}</p>
          </div>
        </div>

        <div className="mt-3 grid gap-3 sm:grid-cols-3">
          <label className="space-y-1.5 text-sm">
            <span className="block font-medium text-foreground">{tr("بداية الدوام")}</span>
            <Input type="time" dir="ltr" value={workStart} onChange={(event) => setWorkStart(event.target.value)} className="h-11 rounded-xl text-center" />
          </label>
          <label className="space-y-1.5 text-sm">
            <span className="block font-medium text-foreground">{tr("نهاية الدوام")}</span>
            <Input type="time" dir="ltr" value={workEnd} onChange={(event) => setWorkEnd(event.target.value)} className="h-11 rounded-xl text-center" />
          </label>
          <label className="space-y-1.5 text-sm">
            <span className="block font-medium text-foreground">{tr("فترة السماح (دقيقة)")}</span>
            <Input
              type="number"
              inputMode="numeric"
              min={0}
              max={240}
              dir="ltr"
              value={grace}
              onChange={(event) => setGrace(event.target.value)}
              className="h-11 rounded-xl text-center"
            />
          </label>
        </div>

        <Button type="button" className="mt-3 h-11 w-full rounded-xl text-sm font-medium" disabled={savingHours} onClick={() => void saveWorkHours()}>
          {savingHours ? <LoaderCircle className="h-4 w-4 animate-spin" aria-hidden /> : <Save className="h-4 w-4" aria-hidden />}
          {tr("حفظ مواعيد الدوام")}
        </Button>
      </section>
      <section className="rounded-2xl border border-border/50 bg-card/75 p-4 shadow-glass backdrop-blur-sm">
        <div className="flex items-center gap-2">
          <span className="flex size-10 items-center justify-center rounded-full bg-primary/10 text-primary">
            <CalendarOff className="h-5 w-5" aria-hidden />
          </span>
          <div>
            <h2 className="text-sm font-semibold text-foreground">{tr("العطلة والتأخير والعملة")}</h2>
            <p className="text-xs text-muted-foreground">{tr("أيام العطلة لا تُسجّل غياباً")}</p>
          </div>
        </div>

        <p className="mt-3 text-sm font-medium text-foreground">{tr("أيام العطلة الأسبوعية")}</p>
        <div className="mt-2 flex flex-wrap gap-1.5">
          {DAYS.map((day) => {
            const on = weekend.includes(day.d);
            return (
              <button
                key={day.d}
                type="button"
                aria-pressed={on}
                onClick={() => setWeekend((cur) => (on ? cur.filter((x) => x !== day.d) : [...cur, day.d]))}
                className={cn("rounded-full border px-3 py-1.5 text-xs font-medium", on ? "border-primary bg-primary text-primary-foreground" : "border-border/60 bg-background text-muted-foreground")}
              >
                {tr(day.l)}
              </button>
            );
          })}
        </div>

        <p className="mt-4 text-sm font-medium text-foreground">{tr("قاعدة خصم التأخير")}</p>
        <div className="mt-2 flex flex-wrap items-center gap-2 text-sm">
          <span>{tr("كل")}</span>
          <Input type="number" inputMode="numeric" min={0} max={600} dir="ltr" value={lateMinutes} onChange={(e) => setLateMinutes(e.target.value)} className="h-10 w-20 rounded-xl text-center" />
          <span>{tr("دقيقة تأخير تعادل")}</span>
          <select value={lateFraction} onChange={(e) => setLateFraction(Number(e.target.value) === 0.5 ? 0.5 : 0.25)} className="h-10 rounded-xl border border-input bg-background px-3 text-sm">
            <option value={0.25}>{tr("ربع يوم")}</option>
            <option value={0.5}>{tr("نصف يوم")}</option>
          </select>
        </div>
        <p className="mt-1 text-[11px] text-muted-foreground">{tr("صفر يعني القاعدة معطلة. القاعدة مرجعية ولا تغيّر حساب الرواتب الحالي.")}</p>

        <label className="mt-4 block space-y-1.5 text-sm">
          <span className="block font-medium text-foreground">{tr("العملة")}</span>
          <select value={currency} onChange={(e) => setCurrency(e.target.value as "YER" | "SAR" | "USD")} className="h-11 w-full rounded-xl border border-input bg-background px-3 text-sm">
            <option value="YER">{currencyLabel("YER")}</option>
            <option value="SAR">{currencyLabel("SAR")}</option>
            <option value="USD">{currencyLabel("USD")}</option>
          </select>
        </label>

        <Button type="button" className="mt-3 h-11 w-full rounded-xl text-sm font-medium" disabled={savingRules} onClick={() => void saveRules()}>
          {savingRules ? <LoaderCircle className="h-4 w-4 animate-spin" aria-hidden /> : <Save className="h-4 w-4" aria-hidden />}
          {tr("حفظ القواعد")}
        </Button>
      </section>
    </div>
  );
}
