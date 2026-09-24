import { createFileRoute } from "@tanstack/react-router";
import {
  CalendarDays,
  CheckCircle2,
  ChevronLeft,
  ChevronRight,
  Clock,
  LoaderCircle,
  LogIn,
  LogOut,
  Plane,
  Plus,
  Save,
  Timer,
  UserRound,
  XCircle,
} from "lucide-react";
import { useCallback, useEffect, useMemo, useState, type FormEvent, type ReactNode } from "react";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { useCurrentUser } from "@/hooks/use-current-user";
import { supabase } from "@/integrations/supabase/client";
import { cn } from "@/lib/utils";

export const Route = createFileRoute("/_authenticated/attendance")({
  head: () => ({
    meta: [
      { title: "الحضور | نظام الموارد البشرية" },
      { name: "description", content: "سجل الحضور اليومي والملخص الشهري وإعدادات الدوام" },
      { property: "og:title", content: "الحضور | نظام الموارد البشرية" },
      { property: "og:description", content: "سجل الحضور اليومي والملخص الشهري وإعدادات الدوام" },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary_large_image" },
    ],
  }),
  component: AttendancePage,
});

type Employee = {
  id: string;
  full_name: string;
  employee_number: string;
  department: string | null;
  position: string | null;
};

type AttendanceRow = {
  id: string;
  employee_id: string;
  date: string;
  status: string;
  check_in: string | null;
  check_out: string | null;
  late_minutes: number;
  note: string | null;
};

type LeaveRow = {
  id: string;
  employee_id: string;
  start_date: string;
  end_date: string;
};

type WorkSettings = {
  work_start: string;
  work_end: string;
  grace_minutes: number;
};

type TabKey = "today" | "monthly" | "settings";

const numberFormatter = new Intl.NumberFormat("ar-YE-u-nu-latn", { maximumFractionDigits: 0 });
const monthFormatter = new Intl.DateTimeFormat("ar-YE-u-nu-latn", { month: "long", year: "numeric" });
const dayFormatter = new Intl.DateTimeFormat("ar-YE-u-nu-latn", { weekday: "long", day: "numeric", month: "long" });

function dateKey(date: Date) {
  return `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, "0")}-${String(date.getDate()).padStart(2, "0")}`;
}

function monthKey(date: Date) {
  return `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, "0")}-01`;
}

function monthLabel(key: string) {
  return monthFormatter.format(new Date(`${key}T00:00:00`));
}

function monthBounds(key: string) {
  const start = new Date(`${key}T00:00:00`);
  const end = new Date(start.getFullYear(), start.getMonth() + 1, 0);
  return { from: dateKey(start), to: dateKey(end) };
}

function shortTime(value: string | null) {
  if (!value) return "--:--";
  return value.slice(0, 5);
}

function minutesOf(value: string) {
  const [hours, minutes] = value.split(":");
  return Number(hours) * 60 + Number(minutes ?? 0);
}

function initials(name: string) {
  const parts = name.trim().split(/\s+/).slice(0, 2);
  return parts.map((part) => part.charAt(0)).join("") || "م";
}

const STATUS_META: Record<string, { label: string; badge: string; dot: string }> = {
  present: { label: "حاضر", badge: "bg-success/12 text-success", dot: "bg-success" },
  late: { label: "متاخر", badge: "bg-warning/20 text-warning-foreground", dot: "bg-warning" },
  absent: { label: "غائب", badge: "bg-destructive/10 text-destructive", dot: "bg-destructive" },
  leave: { label: "في اجازة", badge: "bg-primary/10 text-primary", dot: "bg-primary" },
  none: { label: "لم يسجل", badge: "bg-muted text-muted-foreground", dot: "bg-muted-foreground/40" },
};

function AttendancePage() {
  const { isAdmin, loading: roleLoading } = useCurrentUser();
  const [tab, setTab] = useState<TabKey>("today");
  const [today, setToday] = useState(() => dateKey(new Date()));
  const [employees, setEmployees] = useState<Employee[]>([]);
  const [rows, setRows] = useState<AttendanceRow[]>([]);
  const [leaves, setLeaves] = useState<LeaveRow[]>([]);
  const [settings, setSettings] = useState<WorkSettings>({ work_start: "08:00", work_end: "16:00", grace_minutes: 15 });
  const [loading, setLoading] = useState(true);
  const [feedback, setFeedback] = useState<{ kind: "success" | "error"; message: string } | null>(null);
  const [formOpen, setFormOpen] = useState(false);
  const [editing, setEditing] = useState<{ employee: Employee; row: AttendanceRow | null } | null>(null);

  const load = useCallback(async () => {
    setLoading(true);
    const [employeesResult, rowsResult, leavesResult, settingsResult] = await Promise.all([
      supabase.from("employees").select("id,full_name,employee_number,department,position").eq("status", "active").order("full_name"),
      supabase.from("attendance").select("id,employee_id,date,status,check_in,check_out,late_minutes,note").eq("date", today),
      supabase.from("leave_requests").select("id,employee_id,start_date,end_date").eq("status", "approved").lte("start_date", today).gte("end_date", today),
      supabase.from("app_settings").select("work_start,work_end,grace_minutes").eq("id", "organization").maybeSingle(),
    ]);
    setEmployees((employeesResult.data ?? []) as Employee[]);
    setRows((rowsResult.data ?? []) as AttendanceRow[]);
    setLeaves((leavesResult.data ?? []) as LeaveRow[]);
    if (settingsResult.data) {
      setSettings({
        work_start: shortTime(settingsResult.data.work_start as string),
        work_end: shortTime(settingsResult.data.work_end as string),
        grace_minutes: Number(settingsResult.data.grace_minutes ?? 15),
      });
    }
    setLoading(false);
  }, [today]);

  useEffect(() => {
    void load();
  }, [load]);

  const rowByEmployee = useMemo(() => new Map(rows.map((row) => [row.employee_id, row])), [rows]);
  const leaveSet = useMemo(() => new Set(leaves.map((item) => item.employee_id)), [leaves]);

  const cards = useMemo(
    () =>
      employees.map((employee) => {
        const row = rowByEmployee.get(employee.id) ?? null;
        const onLeave = leaveSet.has(employee.id);
        const status = onLeave ? "leave" : (row?.status ?? "none");
        return { employee, row, status };
      }),
    [employees, rowByEmployee, leaveSet],
  );

  const counts = useMemo(
    () =>
      cards.reduce(
        (acc, card) => ({
          present: acc.present + (card.status === "present" ? 1 : 0),
          late: acc.late + (card.status === "late" ? 1 : 0),
          absent: acc.absent + (card.status === "absent" ? 1 : 0),
          leave: acc.leave + (card.status === "leave" ? 1 : 0),
        }),
        { present: 0, late: 0, absent: 0, leave: 0 },
      ),
    [cards],
  );

  function shiftDay(step: number) {
    const current = new Date(`${today}T00:00:00`);
    current.setDate(current.getDate() + step);
    setToday(dateKey(current));
  }

  function openForm(employee?: Employee) {
    const target = employee ?? employees[0];
    if (!target) {
      setFeedback({ kind: "error", message: "اضف موظفا اولا من قسم الموظفين" });
      return;
    }
    setEditing({ employee: target, row: rowByEmployee.get(target.id) ?? null });
    setFormOpen(true);
  }

  async function saveSettings(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const form = new FormData(event.currentTarget);
    const payload = {
      work_start: String(form.get("work_start") ?? "08:00"),
      work_end: String(form.get("work_end") ?? "16:00"),
      grace_minutes: Math.max(0, Math.min(240, Number(form.get("grace_minutes") ?? 15) || 0)),
    };
    const { error } = await supabase.from("app_settings").update(payload).eq("id", "organization");
    if (error) {
      setFeedback({ kind: "error", message: "تعذر حفظ اعدادات الدوام. الصلاحية للمدير فقط." });
      return;
    }
    setSettings(payload);
    setFeedback({ kind: "success", message: "تم حفظ اعدادات الدوام" });
  }

  return (
    <div className="mx-auto w-full max-w-6xl pb-6">
      <div className="sticky top-[72px] z-30 -mx-4 space-y-3 border-b border-border/40 bg-background/85 px-4 pb-3 pt-3 backdrop-blur-md md:top-[76px] md:-mx-6 md:px-6">
        <div className="flex flex-wrap items-center justify-between gap-2">
          <div className="min-w-0">
            <h2 className="hidden text-xl font-medium leading-[1.6] text-foreground md:block md:text-2xl">الحضور</h2>
            <p className="truncate text-[13px] leading-[1.7] text-muted-foreground">{dayFormatter.format(new Date(`${today}T00:00:00`))}</p>
          </div>
          <div className="flex items-center gap-1 rounded-full border border-border/40 bg-card/75 p-1 shadow-glass backdrop-blur-sm">
            <Button type="button" variant="ghost" size="icon" className="size-8 rounded-full" aria-label="اليوم السابق" onClick={() => shiftDay(-1)}>
              <ChevronRight className="h-4 w-4" aria-hidden />
            </Button>
            <Button type="button" variant="ghost" size="sm" className="h-8 rounded-full px-3 text-xs font-medium" onClick={() => setToday(dateKey(new Date()))}>
              اليوم
            </Button>
            <Button type="button" variant="ghost" size="icon" className="size-8 rounded-full" aria-label="اليوم التالي" onClick={() => shiftDay(1)}>
              <ChevronLeft className="h-4 w-4" aria-hidden />
            </Button>
          </div>
        </div>

        <section className="grid grid-cols-2 gap-2.5 lg:grid-cols-4">
          <KpiCard icon={<CheckCircle2 className="h-5 w-5" aria-hidden />} title="الحاضرون اليوم" value={numberFormatter.format(counts.present)} tone="text-success" />
          <KpiCard icon={<Timer className="h-5 w-5" aria-hidden />} title="المتاخرون" value={numberFormatter.format(counts.late)} tone="text-warning-foreground" />
          <KpiCard icon={<XCircle className="h-5 w-5" aria-hidden />} title="الغائبون" value={numberFormatter.format(counts.absent)} tone="text-destructive" />
          <KpiCard icon={<Plane className="h-5 w-5" aria-hidden />} title="في اجازة" value={numberFormatter.format(counts.leave)} tone="text-primary" />
        </section>

        <nav className="flex gap-1 overflow-x-auto rounded-full border border-border/40 bg-card/75 p-1 shadow-glass backdrop-blur-sm scrollbar-hide">
          {([
            { key: "today", label: "سجل اليوم" },
            { key: "monthly", label: "الملخص الشهري" },
            { key: "settings", label: "اعدادات الدوام" },
          ] as { key: TabKey; label: string }[]).map((item) => (
            <button
              key={item.key}
              type="button"
              onClick={() => setTab(item.key)}
              className={cn(
                "flex-1 whitespace-nowrap rounded-full px-2.5 py-2 text-[13px] font-medium transition-colors md:px-4 md:text-sm",
                tab === item.key ? "bg-primary text-primary-foreground" : "text-muted-foreground hover:bg-muted",
              )}
            >
              {item.label}
            </button>
          ))}
        </nav>
      </div>

      <div className="space-y-3 pt-4">
        {feedback ? (
          <p
            className={cn(
              "rounded-xl border p-3 text-center text-sm leading-[1.7]",
              feedback.kind === "success" ? "border-success/30 bg-success/10 text-success" : "border-destructive/30 bg-destructive/10 text-destructive",
            )}
          >
            {feedback.message}
          </p>
        ) : null}

        {loading ? (
          <p className="flex items-center justify-center gap-2 rounded-2xl border border-border/40 bg-card/75 p-10 text-sm text-muted-foreground shadow-glass backdrop-blur-sm">
            <LoaderCircle className="h-4 w-4 animate-spin" aria-hidden />
            جاري تحميل سجل الحضور
          </p>
        ) : tab === "today" ? (
          <section className="space-y-3">
            <Button type="button" className="h-11 w-full rounded-xl text-sm font-medium md:w-auto md:px-6" onClick={() => openForm()}>
              <Plus className="h-4 w-4" aria-hidden />
              تسجيل حضور يدوي
            </Button>

            {!cards.length ? (
              <EmptyState title="لا يوجد موظفون نشطون" detail="اضف موظفا من قسم الموظفين ليظهر سجل حضوره هنا" />
            ) : (
              <div className="grid gap-2.5 md:grid-cols-2 xl:grid-cols-3">
                {cards.map((card) => {
                  const meta = STATUS_META[card.status] ?? STATUS_META["none"]!;
                  return (
                    <button
                      key={card.employee.id}
                      type="button"
                      onClick={() => openForm(card.employee)}
                      className="w-full rounded-2xl border border-border/40 bg-card/75 p-4 text-start shadow-glass backdrop-blur-sm transition-colors hover:border-primary/30"
                    >
                      <div className="flex items-center gap-3">
                        <span className="flex size-10 shrink-0 items-center justify-center rounded-full bg-primary/10 text-[13px] font-medium text-primary">
                          {initials(card.employee.full_name)}
                        </span>
                        <span className="min-w-0 flex-1">
                          <span className="block truncate text-sm font-medium text-foreground">{card.employee.full_name}</span>
                          <span className="block truncate text-xs text-muted-foreground">
                            {card.employee.department ?? "بدون قسم"} — {card.employee.employee_number}
                          </span>
                        </span>
                        <span className={cn("shrink-0 rounded-full px-2.5 py-1 text-[11px] font-medium", meta.badge)}>{meta.label}</span>
                      </div>
                      <div className="mt-3 flex items-center gap-4 border-t border-border/40 pt-2.5 text-xs text-muted-foreground">
                        <span className="flex items-center gap-1.5">
                          <LogIn className="h-3.5 w-3.5 text-success" aria-hidden />
                          <span dir="ltr">{shortTime(card.row?.check_in ?? null)}</span>
                        </span>
                        <span className="flex items-center gap-1.5">
                          <LogOut className="h-3.5 w-3.5 text-primary" aria-hidden />
                          <span dir="ltr">{shortTime(card.row?.check_out ?? null)}</span>
                        </span>
                        {card.row && card.row.late_minutes > 0 ? (
                          <span className="ms-auto flex items-center gap-1.5 text-warning-foreground">
                            <Clock className="h-3.5 w-3.5" aria-hidden />
                            تاخير {numberFormatter.format(card.row.late_minutes)} د
                          </span>
                        ) : null}
                      </div>
                    </button>
                  );
                })}
              </div>
            )}
          </section>
        ) : tab === "monthly" ? (
          <MonthlyTab employees={employees} />
        ) : (
          <SettingsTab settings={settings} isAdmin={isAdmin} roleLoading={roleLoading} onSubmit={saveSettings} />
        )}
      </div>

      <ManualDialog
        open={formOpen}
        onOpenChange={setFormOpen}
        employees={employees}
        date={today}
        settings={settings}
        editing={editing}
        onEditingChange={setEditing}
        rowByEmployee={rowByEmployee}
        onSaved={async (message) => {
          setFeedback({ kind: "success", message });
          setFormOpen(false);
          await load();
        }}
        onError={(message) => setFeedback({ kind: "error", message })}
      />
    </div>
  );
}

function ManualDialog({
  open,
  onOpenChange,
  employees,
  date,
  settings,
  editing,
  onEditingChange,
  rowByEmployee,
  onSaved,
  onError,
}: {
  open: boolean;
  onOpenChange: (value: boolean) => void;
  employees: Employee[];
  date: string;
  settings: WorkSettings;
  editing: { employee: Employee; row: AttendanceRow | null } | null;
  onEditingChange: (value: { employee: Employee; row: AttendanceRow | null } | null) => void;
  rowByEmployee: Map<string, AttendanceRow>;
  onSaved: (message: string) => Promise<void>;
  onError: (message: string) => void;
}) {
  const [status, setStatus] = useState("present");
  const [checkIn, setCheckIn] = useState("");
  const [checkOut, setCheckOut] = useState("");
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    if (!open || !editing) return;
    setStatus(editing.row?.status ?? "present");
    setCheckIn(editing.row?.check_in ? shortTime(editing.row.check_in) : settings.work_start);
    setCheckOut(editing.row?.check_out ? shortTime(editing.row.check_out) : "");
  }, [open, editing, settings.work_start]);

  async function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!editing) return;
    const late =
      status === "absent" || !checkIn
        ? 0
        : Math.max(0, minutesOf(checkIn) - minutesOf(settings.work_start) - settings.grace_minutes);
    const finalStatus = status === "present" && late > 0 ? "late" : status;
    setSaving(true);
    const { error } = await supabase.from("attendance").upsert(
      {
        employee_id: editing.employee.id,
        date,
        status: finalStatus,
        check_in: status === "absent" ? null : checkIn || null,
        check_out: status === "absent" ? null : checkOut || null,
        late_minutes: late,
      },
      { onConflict: "employee_id,date" },
    );
    setSaving(false);
    if (error) {
      onError("تعذر حفظ سجل الحضور. تحقق من صلاحيتك على هذا الفرع.");
      return;
    }
    await onSaved("تم حفظ سجل الحضور");
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent dir="rtl" className="max-w-md rounded-3xl border-border/40 bg-card/95 backdrop-blur-md">
        <DialogHeader className="text-start">
          <DialogTitle className="text-base font-medium">تسجيل حضور يدوي</DialogTitle>
          <DialogDescription className="text-xs">سجل وقت الدخول والخروج ليوم {date}</DialogDescription>
        </DialogHeader>
        <form onSubmit={(event) => void submit(event)} className="space-y-3">
          <FieldSelect
            label="الموظف"
            value={editing?.employee.id ?? ""}
            placeholder="اختر الموظف"
            onChange={(value) => {
              const employee = employees.find((item) => item.id === value);
              if (employee) onEditingChange({ employee, row: rowByEmployee.get(employee.id) ?? null });
            }}
          >
            {employees.map((employee) => (
              <SelectItem key={employee.id} value={employee.id}>
                {employee.full_name}
              </SelectItem>
            ))}
          </FieldSelect>

          <FieldSelect label="الحالة" value={status} placeholder="اختر الحالة" onChange={setStatus}>
            <SelectItem value="present">حاضر</SelectItem>
            <SelectItem value="late">متاخر</SelectItem>
            <SelectItem value="absent">غائب</SelectItem>
          </FieldSelect>

          <div className="grid grid-cols-2 gap-3">
            <TimeField label="وقت الدخول" value={checkIn} onChange={setCheckIn} disabled={status === "absent"} />
            <TimeField label="وقت الخروج" value={checkOut} onChange={setCheckOut} disabled={status === "absent"} />
          </div>

          <Button type="submit" className="h-11 w-full rounded-xl text-sm font-medium" disabled={saving || !editing}>
            {saving ? <LoaderCircle className="h-4 w-4 animate-spin" aria-hidden /> : <Save className="h-4 w-4" aria-hidden />}
            حفظ السجل
          </Button>
        </form>
      </DialogContent>
    </Dialog>
  );
}

function MonthlyTab({ employees }: { employees: Employee[] }) {
  const [employeeId, setEmployeeId] = useState("");
  const [month, setMonth] = useState(() => monthKey(new Date()));
  const [rows, setRows] = useState<AttendanceRow[]>([]);
  const [leaves, setLeaves] = useState<LeaveRow[]>([]);
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    if (!employeeId && employees[0]) setEmployeeId(employees[0].id);
  }, [employees, employeeId]);

  useEffect(() => {
    if (!employeeId) return;
    const { from, to } = monthBounds(month);
    setLoading(true);
    void (async () => {
      const [rowsResult, leavesResult] = await Promise.all([
        supabase
          .from("attendance")
          .select("id,employee_id,date,status,check_in,check_out,late_minutes,note")
          .eq("employee_id", employeeId)
          .gte("date", from)
          .lte("date", to)
          .order("date"),
        supabase
          .from("leave_requests")
          .select("id,employee_id,start_date,end_date")
          .eq("employee_id", employeeId)
          .eq("status", "approved")
          .lte("start_date", to)
          .gte("end_date", from),
      ]);
      setRows((rowsResult.data ?? []) as AttendanceRow[]);
      setLeaves((leavesResult.data ?? []) as LeaveRow[]);
      setLoading(false);
    })();
  }, [employeeId, month]);

  const summary = useMemo(() => {
    const covered = (date: string) => leaves.some((leave) => leave.start_date <= date && leave.end_date >= date);
    return rows.reduce(
      (acc, row) => ({
        present: acc.present + (row.status === "present" || row.status === "late" ? 1 : 0),
        lateMinutes: acc.lateMinutes + Number(row.late_minutes ?? 0),
        absent: acc.absent + (row.status === "absent" && !covered(row.date) ? 1 : 0),
      }),
      { present: 0, lateMinutes: 0, absent: 0 },
    );
  }, [rows, leaves]);

  function shiftMonth(step: number) {
    const current = new Date(`${month}T00:00:00`);
    current.setMonth(current.getMonth() + step);
    setMonth(monthKey(current));
  }

  const lateHours = Math.floor(summary.lateMinutes / 60);
  const lateRest = summary.lateMinutes % 60;

  return (
    <section className="space-y-3">
      <div className="grid gap-3 rounded-2xl border border-border/40 bg-card/75 p-4 shadow-glass backdrop-blur-sm sm:grid-cols-[1fr_auto] sm:items-end">
        <FieldSelect label="الموظف" value={employeeId} placeholder="اختر الموظف" onChange={setEmployeeId}>
          {employees.map((employee) => (
            <SelectItem key={employee.id} value={employee.id}>
              {employee.full_name}
            </SelectItem>
          ))}
        </FieldSelect>
        <div className="flex items-center gap-1 rounded-full border border-border/40 bg-background/60 p-1">
          <Button type="button" variant="ghost" size="icon" className="size-9 rounded-full" aria-label="الشهر السابق" onClick={() => shiftMonth(-1)}>
            <ChevronRight className="h-4 w-4" aria-hidden />
          </Button>
          <span className="min-w-[120px] text-center text-sm font-medium text-foreground">{monthLabel(month)}</span>
          <Button type="button" variant="ghost" size="icon" className="size-9 rounded-full" aria-label="الشهر التالي" onClick={() => shiftMonth(1)}>
            <ChevronLeft className="h-4 w-4" aria-hidden />
          </Button>
        </div>
      </div>

      {loading ? (
        <p className="flex items-center justify-center gap-2 rounded-2xl border border-border/40 bg-card/75 p-10 text-sm text-muted-foreground shadow-glass backdrop-blur-sm">
          <LoaderCircle className="h-4 w-4 animate-spin" aria-hidden />
          جاري تحميل الملخص
        </p>
      ) : (
        <>
          <div className="grid grid-cols-3 gap-2.5">
            <SummaryCard label="ايام الحضور" value={numberFormatter.format(summary.present)} tone="text-success" />
            <SummaryCard
              label="ساعات التاخير"
              value={`${numberFormatter.format(lateHours)}:${String(lateRest).padStart(2, "0")}`}
              tone="text-warning-foreground"
            />
            <SummaryCard label="غياب غير مبرر" value={numberFormatter.format(summary.absent)} tone="text-destructive" />
          </div>

          {!rows.length ? (
            <EmptyState title="لا توجد سجلات لهذا الشهر" detail="سجل الحضور اليومي ليظهر الملخص هنا" />
          ) : (
            <div className="overflow-hidden rounded-2xl border border-border/40 bg-card/75 shadow-glass backdrop-blur-sm">
              {rows.map((row) => {
                const meta = STATUS_META[row.status] ?? STATUS_META["none"]!;
                return (
                  <div key={row.id} className="flex items-center gap-3 border-b border-border/40 px-4 py-2.5 text-xs last:border-0">
                    <span className={cn("size-2 shrink-0 rounded-full", meta.dot)} />
                    <span className="w-24 shrink-0 text-foreground" dir="ltr">
                      {row.date}
                    </span>
                    <span className="text-muted-foreground" dir="ltr">
                      {shortTime(row.check_in)} - {shortTime(row.check_out)}
                    </span>
                    <span className={cn("ms-auto rounded-full px-2.5 py-1 text-[11px] font-medium", meta.badge)}>{meta.label}</span>
                  </div>
                );
              })}
            </div>
          )}
        </>
      )}
    </section>
  );
}

function SettingsTab({
  settings,
  isAdmin,
  roleLoading,
  onSubmit,
}: {
  settings: WorkSettings;
  isAdmin: boolean;
  roleLoading: boolean;
  onSubmit: (event: FormEvent<HTMLFormElement>) => Promise<void>;
}) {
  if (!roleLoading && !isAdmin) {
    return (
      <p className="rounded-2xl border border-border/40 bg-card/75 p-6 text-center text-sm leading-[1.8] text-muted-foreground shadow-glass backdrop-blur-sm">
        اعدادات الدوام متاحة لمدير النظام فقط.
      </p>
    );
  }

  return (
    <form
      key={`${settings.work_start}-${settings.work_end}-${settings.grace_minutes}`}
      onSubmit={(event) => void onSubmit(event)}
      className="max-w-xl space-y-3 rounded-2xl border border-border/40 bg-card/75 p-4 shadow-glass backdrop-blur-sm"
    >
      <p className="flex items-center gap-2 text-sm font-medium text-foreground">
        <CalendarDays className="h-4 w-4 text-primary" aria-hidden />
        اعدادات الدوام الرسمي
      </p>
      <div className="grid gap-3 sm:grid-cols-2">
        <label className="block space-y-1.5 text-sm">
          <span className="block font-medium text-foreground">وقت بداية الدوام</span>
          <Input name="work_start" type="time" defaultValue={settings.work_start} dir="ltr" className="h-11 rounded-xl text-left" />
        </label>
        <label className="block space-y-1.5 text-sm">
          <span className="block font-medium text-foreground">وقت نهاية الدوام</span>
          <Input name="work_end" type="time" defaultValue={settings.work_end} dir="ltr" className="h-11 rounded-xl text-left" />
        </label>
      </div>
      <label className="block space-y-1.5 text-sm">
        <span className="block font-medium text-foreground">فترة السماح بالدقائق</span>
        <Input
          name="grace_minutes"
          type="number"
          min={0}
          max={240}
          defaultValue={String(settings.grace_minutes)}
          inputMode="numeric"
          dir="ltr"
          className="h-11 rounded-xl text-left"
        />
      </label>
      <Button type="submit" className="h-11 w-full rounded-xl text-sm font-medium sm:w-auto sm:px-6">
        <Save className="h-4 w-4" aria-hidden />
        حفظ التعديلات
      </Button>
    </form>
  );
}

function TimeField({
  label,
  value,
  onChange,
  disabled,
}: {
  label: string;
  value: string;
  onChange: (value: string) => void;
  disabled?: boolean;
}) {
  return (
    <label className="block space-y-1.5 text-sm">
      <span className="block font-medium text-foreground">{label}</span>
      <Input
        type="time"
        value={value}
        onChange={(event) => onChange(event.target.value)}
        disabled={disabled}
        dir="ltr"
        className="h-11 rounded-xl text-left"
      />
    </label>
  );
}

function KpiCard({ icon, title, value, tone }: { icon: ReactNode; title: string; value: string; tone: string }) {
  return (
    <div className="rounded-2xl border border-border/40 bg-card/75 px-3 py-2 shadow-glass backdrop-blur-sm">
      <div className="flex items-center gap-2">
        <span className={cn("flex size-6 shrink-0 items-center justify-center rounded-full bg-muted [&_svg]:size-3.5", tone)}>{icon}</span>
        <p className="truncate text-[11px] font-normal leading-tight text-muted-foreground">{title}</p>
      </div>
      <p className={cn("mt-1 truncate text-lg font-medium leading-tight", tone)} dir="ltr">
        {value}
      </p>
    </div>
  );
}

function SummaryCard({ label, value, tone }: { label: string; value: string; tone: string }) {
  return (
    <div className="rounded-2xl border border-border/40 bg-card/75 p-3 text-center shadow-glass backdrop-blur-sm">
      <p className="truncate text-[11px] font-normal text-muted-foreground">{label}</p>
      <p className={cn("mt-1 text-lg font-medium", tone)} dir="ltr">
        {value}
      </p>
    </div>
  );
}

function FieldSelect({
  label,
  value,
  onChange,
  placeholder,
  children,
}: {
  label: string;
  value: string;
  onChange: (value: string) => void;
  placeholder: string;
  children: ReactNode;
}) {
  return (
    <div className="space-y-1.5 text-sm">
      <span className="block font-medium text-foreground">{label}</span>
      <Select value={value} onValueChange={onChange}>
        <SelectTrigger className="h-11 w-full rounded-xl">
          <SelectValue placeholder={placeholder} />
        </SelectTrigger>
        <SelectContent dir="rtl" className="z-[200]">
          {children}
        </SelectContent>
      </Select>
    </div>
  );
}

function EmptyState({ title, detail }: { title: string; detail: string }) {
  return (
    <div className="rounded-2xl border border-dashed border-border/60 bg-card/60 p-8 text-center shadow-glass backdrop-blur-sm">
      <span className="mx-auto flex size-12 items-center justify-center rounded-full bg-muted text-muted-foreground">
        <UserRound className="h-6 w-6" aria-hidden />
      </span>
      <p className="mt-3 text-sm font-medium text-foreground">{title}</p>
      <p className="mt-1 text-xs leading-[1.8] text-muted-foreground">{detail}</p>
    </div>
  );
}
