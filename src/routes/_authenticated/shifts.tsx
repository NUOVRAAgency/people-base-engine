import { createFileRoute } from "@tanstack/react-router";
import { Clock, LoaderCircle } from "lucide-react";
import { useCallback, useEffect, useState } from "react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { useCurrentUser } from "@/hooks/use-current-user";
import { supabase } from "@/integrations/supabase/client";
import { tr } from "@/lib/i18n";

export const Route = createFileRoute("/_authenticated/shifts")({
  head: () => ({
    meta: [
      { title: tr("الورديات ومواعيد العمل | نظام الموارد البشرية") },
      { name: "description", content: tr("تعريف الورديات وقواعد التأخير والانصراف وربط الموظفين بمواعيد العمل") },
      { property: "og:title", content: tr("الورديات ومواعيد العمل | نظام الموارد البشرية") },
      { property: "og:description", content: tr("تعريف الورديات وقواعد التأخير والانصراف وربط الموظفين بمواعيد العمل") },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary_large_image" },
    ],
  }),
  component: ShiftsPage,
});

type Shift = { id: string; name: string; start_time: string; end_time: string; grace_minutes: number; early_leave_minutes: number; missing_checkout_rule: string };
type Emp = { id: string; full_name: string; employee_number: string };
type Link = { employee_id: string; shift_id: string; cost_center_id: string | null };

const sel = "h-10 w-full rounded-xl border border-input bg-background px-3 text-sm";
const card = "space-y-3 rounded-2xl border border-border/50 bg-card p-5 shadow-glass";
const RULES: Record<string, string> = { early_leave: "انصراف مبكر", absent: "غياب", present: "حضور كامل" };

function ShiftsPage() {
  const { isAdmin, loading } = useCurrentUser();
  const [shifts, setShifts] = useState<Shift[]>([]);
  const [emps, setEmps] = useState<Emp[]>([]);
  const [links, setLinks] = useState<Link[]>([]);
  const [centers, setCenters] = useState<{ id: string; name: string }[]>([]);
  const [f, setF] = useState({ name: "", start_time: "08:00", end_time: "16:00", grace_minutes: "15", early_leave_minutes: "15", missing_checkout_rule: "early_leave" });

  const load = useCallback(async () => {
    const [s, e, l, c] = await Promise.all([
      supabase.from("work_shifts").select("*").order("start_time"),
      supabase.from("employees").select("id,full_name,employee_number").eq("status", "active").order("full_name"),
      supabase.from("employee_shifts").select("employee_id,shift_id,cost_center_id"),
      supabase.from("cost_centers").select("id,name").eq("is_active", true),
    ]);
    setShifts((s.data ?? []) as Shift[]); setEmps(e.data ?? []); setLinks(l.data ?? []); setCenters(c.data ?? []);
  }, []);
  useEffect(() => { void load(); }, [load]);

  async function addShift() {
    if (!f.name.trim()) { toast.error(tr("أدخل اسم الوردية")); return; }
    const { error } = await supabase.from("work_shifts").insert({ ...f, name: f.name.trim(), grace_minutes: Number(f.grace_minutes) || 0, early_leave_minutes: Number(f.early_leave_minutes) || 0 });
    if (error) toast.error(error.code === "23505" ? tr("هذا الرمز أو الاسم مستخدم مسبقاً") : tr("تعذر الحفظ، تحقق من البيانات والصلاحيات")); else { toast.success(tr("تم الحفظ")); setF({ ...f, name: "" }); void load(); }
  }
  async function assign(employee_id: string, shift_id: string, cost_center_id: string | null) {
    const { error } = shift_id
      ? await supabase.from("employee_shifts").upsert({ employee_id, shift_id, cost_center_id }, { onConflict: "employee_id" })
      : await supabase.from("employee_shifts").delete().eq("employee_id", employee_id);
    if (error) toast.error(error.code === "23505" ? tr("هذا الرمز أو الاسم مستخدم مسبقاً") : tr("تعذر الحفظ، تحقق من البيانات والصلاحيات")); else void load();
  }

  if (loading) return <LoaderCircle className="mx-auto mt-10 animate-spin text-primary" />;

  return (
    <div className="mx-auto w-full max-w-4xl space-y-4 pb-6">
      {isAdmin && (
        <section className={card}>
          <h2 className="flex items-center gap-2 font-bold"><Clock className="size-4 text-primary" />{tr("وردية جديدة")}</h2>
          <div className="grid gap-3 sm:grid-cols-3">
            <label className="space-y-1 text-sm">{tr("اسم الوردية")}<Input value={f.name} onChange={(e) => setF({ ...f, name: e.target.value })} /></label>
            <label className="space-y-1 text-sm">{tr("بداية الدوام")}<Input type="time" value={f.start_time} onChange={(e) => setF({ ...f, start_time: e.target.value })} /></label>
            <label className="space-y-1 text-sm">{tr("نهاية الدوام")}<Input type="time" value={f.end_time} onChange={(e) => setF({ ...f, end_time: e.target.value })} /></label>
            <label className="space-y-1 text-sm">{tr("سماح التأخير (دقيقة)")}<Input type="number" min="0" value={f.grace_minutes} onChange={(e) => setF({ ...f, grace_minutes: e.target.value })} /></label>
            <label className="space-y-1 text-sm">{tr("سماح الانصراف المبكر (دقيقة)")}<Input type="number" min="0" value={f.early_leave_minutes} onChange={(e) => setF({ ...f, early_leave_minutes: e.target.value })} /></label>
            <label className="space-y-1 text-sm">{tr("إذا لم يبصم انصرافاً يُعتبر")}<select className={sel} value={f.missing_checkout_rule} onChange={(e) => setF({ ...f, missing_checkout_rule: e.target.value })}>{Object.entries(RULES).map(([k, v]) => <option key={k} value={k}>{tr(v)}</option>)}</select></label>
          </div>
          <p className="text-xs text-muted-foreground">{tr("عدم بصمة الحضور يُعتبر غياباً، والتأخير يُحسب بعد فترة السماح.")}</p>
          <Button size="sm" onClick={addShift}>{tr("إضافة الوردية")}</Button>
        </section>
      )}

      <section className={card}>
        <h2 className="font-bold">{tr("الورديات")}</h2>
        {!shifts.length ? <p className="text-sm text-muted-foreground">{tr("لا توجد ورديات بعد")}</p> : (
          <div className="divide-y divide-border/50 text-sm">{shifts.map((s) => (
            <div key={s.id} className="flex flex-wrap justify-between gap-2 py-2"><span className="font-medium">{s.name}</span>
              <span className="text-muted-foreground">{s.start_time.slice(0, 5)} – {s.end_time.slice(0, 5)} · {tr("سماح")} {s.grace_minutes} · {tr(RULES[s.missing_checkout_rule] ?? s.missing_checkout_rule)}</span></div>
          ))}</div>
        )}
      </section>

      <section className={card}>
        <h2 className="font-bold">{tr("ربط الموظفين بمواعيد العمل")}</h2>
        {!emps.length ? <p className="text-sm text-muted-foreground">{tr("لا يوجد موظفون نشطون")}</p> : (
          <div className="divide-y divide-border/50 text-sm">{emps.map((e) => {
            const l = links.find((x) => x.employee_id === e.id);
            return (
              <div key={e.id} className="grid items-center gap-2 py-2 sm:grid-cols-3">
                <span>{e.full_name} <span className="text-muted-foreground">#{e.employee_number}</span></span>
                <select className={sel} disabled={!isAdmin} value={l?.shift_id ?? ""} onChange={(ev) => assign(e.id, ev.target.value, l?.cost_center_id ?? null)}><option value="">{tr("بدون وردية")}</option>{shifts.map((s) => <option key={s.id} value={s.id}>{s.name}</option>)}</select>
                <select className={sel} disabled={!isAdmin || !l} value={l?.cost_center_id ?? ""} onChange={(ev) => l && assign(e.id, l.shift_id, ev.target.value || null)}><option value="">{tr("بدون مركز تكلفة")}</option>{centers.map((c) => <option key={c.id} value={c.id}>{c.name}</option>)}</select>
              </div>
            );
          })}</div>
        )}
      </section>
    </div>
  );
}
