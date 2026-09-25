import { createFileRoute } from "@tanstack/react-router";
import { Building2, Clock3, LoaderCircle, Save } from "lucide-react";
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

const shortTime = (value: string | null | undefined) => (value ? value.slice(0, 5) : "");

function SystemSettingsPage() {
  const { isAdmin, loading: roleLoading } = useCurrentUser();
  const [companyName, setCompanyName] = useState("");
  const [workStart, setWorkStart] = useState("08:00");
  const [workEnd, setWorkEnd] = useState("16:00");
  const [grace, setGrace] = useState("15");
  const [loading, setLoading] = useState(true);
  const [savingCompany, setSavingCompany] = useState(false);
  const [savingHours, setSavingHours] = useState(false);
  const [feedback, setFeedback] = useState<{ kind: "success" | "error"; message: string } | null>(null);

  useEffect(() => {
    if (roleLoading) return;
    void (async () => {
      const { data } = await supabase
        .from("app_settings")
        .select("company_name,work_start,work_end,grace_minutes")
        .eq("id", "organization")
        .maybeSingle();
      if (data) {
        setCompanyName(data.company_name ?? "");
        setWorkStart(shortTime(data.work_start) || "08:00");
        setWorkEnd(shortTime(data.work_end) || "16:00");
        setGrace(String(data.grace_minutes ?? 15));
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
    </div>
  );
}
