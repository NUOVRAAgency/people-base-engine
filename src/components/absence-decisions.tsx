import { ChevronLeft, ChevronRight, History, LoaderCircle, Undo2 } from "lucide-react";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { supabase } from "@/integrations/supabase/client";
import { getLocale, tr, trf } from "@/lib/i18n";
import { cn } from "@/lib/utils";

export type AbsenceDecision = "pending" | "deducted" | "excused";

export const DECISION_META: Record<AbsenceDecision, { label: string; badge: string }> = {
  pending: { label: tr("قيد المراجعة"), badge: "bg-warning/20 text-warning-foreground" },
  deducted: { label: tr("خصم"), badge: "bg-destructive/10 text-destructive" },
  excused: { label: tr("إعفاء"), badge: "bg-success/12 text-success" },
};

const ERRORS: Record<string, string> = {
  payroll_locked: "راتب هذا الشهر معتمد أو مدفوع. أعد فتح الراتب أولاً لتغيير القرار.",
  payroll_missing: "ولّد مسير رواتب هذا الشهر أولاً لاحتساب قيمة الإعفاء.",
  has_leave: "هذا الغياب مغطى بإجازة معتمدة ولا يُخصم أصلاً.",
  forbidden: "قرار الغياب لمدير النظام فقط.",
  not_absent: "هذا السجل لم يعد غياباً.",
};

function errorText(message: string | undefined) {
  const key = Object.keys(ERRORS).find((k) => message?.includes(k));
  return tr(key ? ERRORS[key]! : "تعذر حفظ القرار");
}

type Absence = { id: string; employee_id: string; date: string; absence_decision: AbsenceDecision; decided_at: string | null };
type LogRow = { id: string; employee_id: string; absence_date: string; from_decision: AbsenceDecision; to_decision: AbsenceDecision; decided_by: string | null; created_at: string };

function monthKey(date: Date) {
  return `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, "0")}-01`;
}
function monthEnd(key: string) {
  const d = new Date(`${key}T00:00:00`);
  const end = new Date(d.getFullYear(), d.getMonth() + 1, 0);
  return `${end.getFullYear()}-${String(end.getMonth() + 1).padStart(2, "0")}-${String(end.getDate()).padStart(2, "0")}`;
}

export function AbsenceDecisions({ isAdmin }: { isAdmin: boolean }) {
  const [month, setMonth] = useState(() => monthKey(new Date()));
  const [view, setView] = useState<"list" | "log">("list");
  const [onlyPending, setOnlyPending] = useState(false);
  const [rows, setRows] = useState<Absence[]>([]);
  const [logs, setLogs] = useState<LogRow[]>([]);
  const [names, setNames] = useState<Map<string, string>>(new Map());
  const [emails, setEmails] = useState<Map<string, string>>(new Map());
  const [loading, setLoading] = useState(true);
  const [target, setTarget] = useState<Absence | null>(null);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");
  const [undo, setUndo] = useState<{ id: string; previous: AbsenceDecision } | null>(null);
  const timer = useRef<ReturnType<typeof setTimeout> | null>(null);

  const dateFmt = useMemo(() => new Intl.DateTimeFormat(getLocale(), { weekday: "short", day: "numeric", month: "short" }), []);
  const stampFmt = useMemo(() => new Intl.DateTimeFormat(getLocale(), { day: "numeric", month: "short", hour: "2-digit", minute: "2-digit" }), []);
  const monthFmt = useMemo(() => new Intl.DateTimeFormat(getLocale(), { month: "long", year: "numeric" }), []);

  const load = useCallback(async () => {
    setLoading(true);
    const [abs, emp, log, users] = await Promise.all([
      supabase.from("attendance").select("id,employee_id,date,absence_decision,decided_at").eq("status", "absent").gte("date", month).lte("date", monthEnd(month)).order("date", { ascending: false }),
      supabase.from("employees").select("id,full_name"),
      supabase.from("absence_decision_log").select("id,employee_id,absence_date,from_decision,to_decision,decided_by,created_at").order("created_at", { ascending: false }).limit(200),
      supabase.from("users").select("id,email,full_name"),
    ]);
    setRows((abs.data ?? []) as Absence[]);
    setNames(new Map((emp.data ?? []).map((e) => [e.id, e.full_name])));
    setLogs((log.data ?? []) as LogRow[]);
    setEmails(new Map((users.data ?? []).map((u) => [u.id, (u.full_name as string | null) || u.email])));
    setLoading(false);
  }, [month]);

  useEffect(() => {
    void load();
  }, [load]);

  useEffect(() => () => { if (timer.current) clearTimeout(timer.current); }, []);

  const pendingCount = rows.filter((r) => r.absence_decision === "pending").length;
  const visible = onlyPending ? rows.filter((r) => r.absence_decision === "pending") : rows;

  async function apply(id: string, decision: AbsenceDecision, withUndo: boolean) {
    setSaving(true);
    setError("");
    const { data, error: rpcError } = await supabase.rpc("set_absence_decision", { _attendance_id: id, _decision: decision });
    setSaving(false);
    if (rpcError) {
      setError(errorText(rpcError.message));
      return false;
    }
    setTarget(null);
    if (timer.current) clearTimeout(timer.current);
    if (withUndo && data && data !== decision) {
      setUndo({ id, previous: data as AbsenceDecision });
      timer.current = setTimeout(() => setUndo(null), 8000);
    } else setUndo(null);
    await load();
    return true;
  }

  function shift(step: number) {
    const d = new Date(`${month}T00:00:00`);
    d.setMonth(d.getMonth() + step);
    setMonth(monthKey(d));
  }

  return (
    <section className="space-y-3">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <div className="flex gap-1 rounded-full border border-border/40 bg-card/75 p-1 shadow-glass">
          <button type="button" onClick={() => setView("list")} className={cn("rounded-full px-3 py-1.5 text-xs font-medium", view === "list" ? "bg-primary text-primary-foreground" : "text-muted-foreground")}>{tr("قرارات الغياب")}</button>
          <button type="button" onClick={() => setView("log")} className={cn("flex items-center gap-1 rounded-full px-3 py-1.5 text-xs font-medium", view === "log" ? "bg-primary text-primary-foreground" : "text-muted-foreground")}>
            <History className="h-3.5 w-3.5" aria-hidden />{tr("سجل القرارات")}
          </button>
        </div>
        {view === "list" ? (
          <div className="flex items-center gap-1 rounded-full border border-border/40 bg-card/75 p-1 shadow-glass">
            <Button type="button" variant="ghost" size="icon" className="size-8 rounded-full" aria-label={tr("الشهر السابق")} onClick={() => shift(-1)}><ChevronRight className="h-4 w-4" aria-hidden /></Button>
            <span className="min-w-[110px] text-center text-xs font-medium">{monthFmt.format(new Date(`${month}T00:00:00`))}</span>
            <Button type="button" variant="ghost" size="icon" className="size-8 rounded-full" aria-label={tr("الشهر التالي")} onClick={() => shift(1)}><ChevronLeft className="h-4 w-4" aria-hidden /></Button>
          </div>
        ) : null}
      </div>

      {view === "list" ? (
        <button
          type="button"
          onClick={() => setOnlyPending((v) => !v)}
          className={cn("flex items-center gap-2 rounded-full border px-3 py-1.5 text-xs font-medium", onlyPending ? "border-primary bg-primary/10 text-primary" : "border-border/50 bg-card text-muted-foreground")}
        >
          {tr("بانتظار قرار")}
          <span className="rounded-full bg-warning/25 px-2 text-[11px] text-warning-foreground">{pendingCount}</span>
        </button>
      ) : null}

      {undo ? (
        <div className="flex items-center justify-between gap-2 rounded-xl border border-primary/25 bg-primary/5 px-3 py-2 text-sm">
          <span>{tr("تم حفظ القرار")}</span>
          <Button type="button" size="sm" variant="ghost" className="h-8 gap-1 text-primary" disabled={saving} onClick={() => void apply(undo.id, undo.previous, false)}>
            <Undo2 className="h-4 w-4" aria-hidden />{tr("تراجع")}
          </Button>
        </div>
      ) : null}
      {error && !target ? <p className="rounded-xl border border-destructive/25 bg-destructive/5 p-2.5 text-center text-xs text-destructive">{error}</p> : null}

      {loading ? (
        <p className="flex items-center justify-center gap-2 py-10 text-sm text-muted-foreground"><LoaderCircle className="h-4 w-4 animate-spin" aria-hidden />{tr("جاري التحميل")}</p>
      ) : view === "list" ? (
        !visible.length ? (
          <p className="rounded-2xl border border-border/40 bg-card/75 p-8 text-center text-sm text-muted-foreground">{tr("لا توجد بيانات")}</p>
        ) : (
          <ul className="overflow-hidden rounded-2xl border border-border/40 bg-card/75 shadow-glass">
            {visible.map((r, i) => {
              const meta = DECISION_META[r.absence_decision];
              return (
                <li key={r.id} className={cn("flex items-center gap-3 px-4 py-3", i > 0 && "border-t border-border/40")}>
                  <div className="min-w-0 flex-1">
                    <p dir="auto" className="truncate text-sm font-medium">{names.get(r.employee_id) ?? "—"}</p>
                    <p className="text-xs text-muted-foreground">{dateFmt.format(new Date(`${r.date}T00:00:00`))}</p>
                  </div>
                  <button
                    type="button"
                    disabled={!isAdmin}
                    onClick={() => { setError(""); setTarget(r); }}
                    className={cn("rounded-full px-2.5 py-1 text-[11px] font-medium", meta.badge, isAdmin ? "cursor-pointer" : "cursor-default")}
                  >
                    {meta.label}
                  </button>
                </li>
              );
            })}
          </ul>
        )
      ) : !logs.length ? (
        <p className="rounded-2xl border border-border/40 bg-card/75 p-8 text-center text-sm text-muted-foreground">{tr("لا توجد بيانات")}</p>
      ) : (
        <ul className="overflow-hidden rounded-2xl border border-border/40 bg-card/75 shadow-glass">
          {logs.map((l, i) => (
            <li key={l.id} className={cn("space-y-1 px-4 py-3 text-sm", i > 0 && "border-t border-border/40")}>
              <p dir="auto" className="font-medium">{names.get(l.employee_id) ?? "—"} <span className="text-xs text-muted-foreground">— {dateFmt.format(new Date(`${l.absence_date}T00:00:00`))}</span></p>
              <p className="text-xs text-muted-foreground">
                {trf("من {0} إلى {1}", DECISION_META[l.from_decision].label, DECISION_META[l.to_decision].label)} · {l.decided_by ? (emails.get(l.decided_by) ?? "—") : "—"} · {stampFmt.format(new Date(l.created_at))}
              </p>
            </li>
          ))}
        </ul>
      )}

      <Dialog open={target !== null} onOpenChange={(o) => !o && setTarget(null)}>
        <DialogContent className="max-w-sm rounded-2xl">
          <DialogHeader className="text-start">
            <DialogTitle className="text-base font-semibold">{tr("قرار الغياب")}</DialogTitle>
            <DialogDescription className="text-xs">
              {target ? `${names.get(target.employee_id) ?? ""} — ${dateFmt.format(new Date(`${target.date}T00:00:00`))}` : ""}
            </DialogDescription>
          </DialogHeader>
          <p className="text-xs leading-[1.8] text-muted-foreground">{tr("الغياب بلا إجازة معتمدة يُخصم تلقائياً بقيمة يوم. الإعفاء يضيف قيمة اليوم نفسها إلى القسيمة.")}</p>
          <div className="grid gap-2">
            {(["deducted", "excused", "pending"] as const).map((d) => (
              <Button
                key={d}
                type="button"
                variant={target?.absence_decision === d ? "default" : "outline"}
                className="h-11 rounded-xl"
                disabled={saving || target?.absence_decision === d}
                onClick={() => target && void apply(target.id, d, true)}
              >
                {d === "pending" ? tr("إعادة إلى قيد المراجعة") : DECISION_META[d].label}
              </Button>
            ))}
          </div>
          {error ? <p className="rounded-xl border border-destructive/25 bg-destructive/5 p-2.5 text-center text-xs text-destructive">{error}</p> : null}
        </DialogContent>
      </Dialog>
    </section>
  );
}
