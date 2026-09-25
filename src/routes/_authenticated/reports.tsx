import { createFileRoute, Link } from "@tanstack/react-router";
import { useServerFn } from "@tanstack/react-start";
import {
  Building2,
  CalendarDays,
  ChevronLeft,
  ChevronRight,
  ClipboardList,
  Clock3,
  Download,
  FileSearch,
  HandCoins,
  LoaderCircle,
  TrendingDown,
  UserRound,
  Wallet,
} from "lucide-react";
import { useCallback, useEffect, useMemo, useState, type ReactNode } from "react";
import { Button } from "@/components/ui/button";


import { useCurrentUser } from "@/hooks/use-current-user";
import { supabase } from "@/integrations/supabase/client";
import { generateSmartReport } from "@/lib/ai-reports.functions";
import { cn } from "@/lib/utils";

import { tr, trf } from "@/lib/i18n";
export const Route = createFileRoute("/_authenticated/reports")({
  head: () => ({
    meta: [
      { title: tr("التقارير | نظام الموارد البشرية") },
      { name: "description", content: tr("تقارير مالية وحضور وإجازات مع تحليل ذكي شهري") },
      { property: "og:title", content: tr("التقارير | نظام الموارد البشرية") },
      { property: "og:description", content: tr("تقارير مالية وحضور وإجازات مع تحليل ذكي شهري") },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary_large_image" },
    ],
  }),
  component: ReportsPage,
});

type Employee = {
  id: string;
  full_name: string;
  employee_number: string;
  department: string | null;
};

type PayrollRow = {
  employee_id: string;
  base_salary: number;
  deductions: number;
  net_salary: number;
};

type LoanRow = {
  employee_id: string;
  total_amount: number;
  paid_amount: number;
  status: string;
};

type AttendanceRow = {
  employee_id: string;
  date: string;
  status: string;
  late_minutes: number;
};

type LeaveRow = {
  employee_id: string;
  leave_type: string;
  status: string;
  start_date: string;
  end_date: string;
};

type TabKey = "finance" | "attendance" | "leaves" | "insights";

const numberFormatter = new Intl.NumberFormat(getLocale(), { maximumFractionDigits: 0 });
const decimalFormatter = new Intl.NumberFormat(getLocale(), { maximumFractionDigits: 1 });
const monthFormatter = new Intl.DateTimeFormat(getLocale(), { month: "long", year: "numeric" });

const LEAVE_LABELS: Record<string, string> = {
  annual: tr("سنوية"),
  sick: tr("مرضية"),
  unpaid: tr("بدون راتب"),
  emergency: tr("طارئة"),
  other: tr("اخرى"),
};

function money(value: number) {
  return trf("{0} ر.ي", numberFormatter.format(Math.round(value)));
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
  const pad = (value: number) => String(value).padStart(2, "0");
  return {
    from: `${start.getFullYear()}-${pad(start.getMonth() + 1)}-01`,
    to: `${end.getFullYear()}-${pad(end.getMonth() + 1)}-${pad(end.getDate())}`,
  };
}

function ReportsPage() {
  const { isAdmin, loading: roleLoading } = useCurrentUser();
  const [month, setMonth] = useState(() => monthKey(new Date()));
  const [tab, setTab] = useState<TabKey>("finance");
  const [employees, setEmployees] = useState<Employee[]>([]);
  const [payroll, setPayroll] = useState<PayrollRow[]>([]);
  const [loans, setLoans] = useState<LoanRow[]>([]);
  const [attendance, setAttendance] = useState<AttendanceRow[]>([]);
  const [leaves, setLeaves] = useState<LeaveRow[]>([]);
  const [loading, setLoading] = useState(true);

  const load = useCallback(async () => {
    setLoading(true);
    const bounds = monthBounds(month);
    const [employeesResult, payrollResult, loansResult, attendanceResult, leavesResult] = await Promise.all([
      supabase.from("employees").select("id,full_name,employee_number,department").eq("status", "active").order("full_name"),
      supabase.from("payroll").select("employee_id,base_salary,deductions,net_salary").eq("month", month),
      supabase.from("employee_loans").select("employee_id,total_amount,paid_amount,status").eq("status", "active"),
      supabase.from("attendance").select("employee_id,date,status,late_minutes").gte("date", bounds.from).lte("date", bounds.to),
      supabase.from("leave_requests").select("employee_id,leave_type,status,start_date,end_date").lte("start_date", bounds.to).gte("end_date", bounds.from),
    ]);
    setEmployees((employeesResult.data ?? []) as Employee[]);
    setPayroll((payrollResult.data ?? []) as PayrollRow[]);
    setLoans((loansResult.data ?? []) as LoanRow[]);
    setAttendance((attendanceResult.data ?? []) as AttendanceRow[]);
    setLeaves((leavesResult.data ?? []) as LeaveRow[]);
    setLoading(false);
  }, [month]);

  useEffect(() => {
    void load();
  }, [load]);

  const employeeById = useMemo(() => new Map(employees.map((item) => [item.id, item])), [employees]);

  const finance = useMemo(() => {
    const net = payroll.reduce((total, row) => total + Number(row.net_salary), 0);
    const deductions = payroll.reduce((total, row) => total + Number(row.deductions), 0);
    const outstanding = loans.reduce((total, row) => total + Math.max(0, Number(row.total_amount) - Number(row.paid_amount)), 0);
    const byDepartment = new Map<string, { total: number; count: number }>();
    payroll.forEach((row) => {
      const name = employeeById.get(row.employee_id)?.department ?? tr("بدون قسم");
      const current = byDepartment.get(name) ?? { total: 0, count: 0 };
      byDepartment.set(name, { total: current.total + Number(row.net_salary), count: current.count + 1 });
    });
    const departments = [...byDepartment.entries()]
      .map(([name, value]) => ({ name, ...value, share: net > 0 ? (value.total / net) * 100 : 0 }))
      .sort((a, b) => b.total - a.total);
    return { net, deductions, outstanding, departments };
  }, [payroll, loans, employeeById]);

  const attendanceStats = useMemo(() => {
    const total = attendance.length;
    const present = attendance.filter((row) => row.status === "present").length;
    const late = attendance.filter((row) => row.status === "late").length;
    const absent = attendance.filter((row) => row.status === "absent").length;
    const lateMinutes = attendance.reduce((sum, row) => sum + Number(row.late_minutes ?? 0), 0);
    const compliance = total > 0 ? ((present + late - absent > 0 ? present : 0) / total) * 100 : 0;
    const perEmployee = new Map<string, { late: number; absent: number; minutes: number }>();
    attendance.forEach((row) => {
      const current = perEmployee.get(row.employee_id) ?? { late: 0, absent: 0, minutes: 0 };
      perEmployee.set(row.employee_id, {
        late: current.late + (row.status === "late" ? 1 : 0),
        absent: current.absent + (row.status === "absent" ? 1 : 0),
        minutes: current.minutes + Number(row.late_minutes ?? 0),
      });
    });
    const top = [...perEmployee.entries()]
      .map(([id, value]) => ({ id, ...value }))
      .filter((item) => item.late > 0 || item.absent > 0)
      .sort((a, b) => b.absent * 3 + b.late - (a.absent * 3 + a.late))
      .slice(0, 6);
    return { total, present, late, absent, lateMinutes, compliance, top };
  }, [attendance]);

  const leaveStats = useMemo(() => {
    const approved = leaves.filter((row) => row.status === "approved");
    const byType = new Map<string, number>();
    approved.forEach((row) => {
      const days =
        Math.floor((new Date(`${row.end_date}T00:00:00`).getTime() - new Date(`${row.start_date}T00:00:00`).getTime()) / 86400000) + 1;
      byType.set(row.leave_type, (byType.get(row.leave_type) ?? 0) + Math.max(1, days));
    });
    const types = [...byType.entries()].map(([key, days]) => ({ key, label: LEAVE_LABELS[key] ?? key, days })).sort((a, b) => b.days - a.days);
    const totalDays = types.reduce((sum, item) => sum + item.days, 0);

    const byDepartment = new Map<string, { used: number; headcount: number }>();
    employees.forEach((employee) => {
      const name = employee.department ?? tr("بدون قسم");
      const current = byDepartment.get(name) ?? { used: 0, headcount: 0 };
      byDepartment.set(name, { used: current.used, headcount: current.headcount + 1 });
    });
    approved.forEach((row) => {
      const name = employeeById.get(row.employee_id)?.department ?? tr("بدون قسم");
      const current = byDepartment.get(name) ?? { used: 0, headcount: 0 };
      const days =
        Math.floor((new Date(`${row.end_date}T00:00:00`).getTime() - new Date(`${row.start_date}T00:00:00`).getTime()) / 86400000) + 1;
      byDepartment.set(name, { used: current.used + Math.max(1, days), headcount: current.headcount });
    });
    const departments = [...byDepartment.entries()]
      .map(([name, value]) => ({
        name,
        used: value.used,
        balance: Math.max(0, value.headcount * 30 - value.used),
        headcount: value.headcount,
      }))
      .sort((a, b) => b.used - a.used);

    return { types, totalDays, departments, pending: leaves.filter((row) => row.status === "pending").length };
  }, [leaves, employees, employeeById]);

  function shiftMonth(step: number) {
    const current = new Date(`${month}T00:00:00`);
    current.setMonth(current.getMonth() + step);
    setMonth(monthKey(current));
  }

  function exportReport() {
    const rows: string[][] = [
      [tr("التقرير"), monthLabel(month)],
      [],
      [tr("إجمالي الرواتب المصروفة"), String(Math.round(finance.net))],
      [tr("إجمالي الخصومات"), String(Math.round(finance.deductions))],
      [tr("السلف القائمة"), String(Math.round(finance.outstanding))],
      [],
      [tr("القسم"), tr("إجمالي المصروف")],
      ...finance.departments.map((item) => [item.name, String(Math.round(item.total))]),
      [],
      [tr("أيام الحضور"), String(attendanceStats.present)],
      [tr("أيام التأخير"), String(attendanceStats.late)],
      [tr("دقائق التأخير"), String(attendanceStats.lateMinutes)],
      [tr("أيام الغياب"), String(attendanceStats.absent)],
      [],
      [tr("نوع الإجازة"), tr("الأيام")],
      ...leaveStats.types.map((item) => [item.label, String(item.days)]),
    ];
    const csv = "\uFEFF" + rows.map((row) => row.join(",")).join("\n");
    const url = URL.createObjectURL(new Blob([csv], { type: "text/csv;charset=utf-8" }));
    const link = document.createElement("a");
    link.href = url;
    link.download = `report-${month}.csv`;
    link.click();
    URL.revokeObjectURL(url);
  }

  const summaryForAi = useMemo(
    () =>
      [
        trf("الشهر: {0}", monthLabel(month)),
        trf("عدد الموظفين النشطين: {0}", employees.length),
        trf("اجمالي الرواتب: {0} ريال", Math.round(finance.net)),
        trf("اجمالي الخصومات: {0} ريال", Math.round(finance.deductions)),
        trf("السلف القائمة: {0} ريال", Math.round(finance.outstanding)),
        trf("ايام الحضور: {0}, التاخير: {1}, الغياب: {2}, دقائق التاخير: {3}", attendanceStats.present, attendanceStats.late, attendanceStats.absent, attendanceStats.lateMinutes),
        trf("ايام الاجازات المعتمدة: {0}, طلبات معلقة: {1}", leaveStats.totalDays, leaveStats.pending),
        trf("توزيع المصروفات: {0}", finance.departments.map((item) => `${item.name}: ${Math.round(item.total)}`).join(" | ") || "لا يوجد"),
      ].join("\n"),
    [month, employees.length, finance, attendanceStats, leaveStats],
  );

  return (
    <div className="mx-auto w-full max-w-6xl space-y-5 pb-6">
      <header className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h2 className="hidden text-xl font-medium leading-[1.6] text-foreground md:block md:text-2xl">{tr("التقارير")}</h2>
          <p className="text-sm leading-[1.7] text-muted-foreground">{tr("ملخص مالي وحضور واجازات مع تحليل ذكي")}</p>
        </div>
        <div className="flex items-center gap-2">
          <div className="flex items-center gap-1 rounded-full border border-border/60 bg-card/75 p-1 shadow-glass backdrop-blur-sm">
            <Button type="button" variant="ghost" size="icon" className="size-9 rounded-full" aria-label={tr("الشهر السابق")} onClick={() => shiftMonth(-1)}>
              <ChevronRight className="h-4 w-4" aria-hidden />
            </Button>
            <span className="min-w-[120px] text-center text-sm font-medium text-foreground">{monthLabel(month)}</span>
            <Button type="button" variant="ghost" size="icon" className="size-9 rounded-full" aria-label={tr("الشهر التالي")} onClick={() => shiftMonth(1)}>
              <ChevronLeft className="h-4 w-4" aria-hidden />
            </Button>
          </div>
          <Button type="button" className="h-10 rounded-xl px-4 text-sm font-medium" onClick={exportReport}>
            <Download className="h-4 w-4" aria-hidden />
            {tr("تصدير التقرير")}
          </Button>
        </div>
      </header>

      {!roleLoading && !isAdmin ? (
        <p className="rounded-2xl border border-border bg-card p-6 text-center text-sm leading-[1.8] text-muted-foreground shadow-glass">
          {tr("التقارير متاحة لمدير النظام فقط.")}
        </p>
      ) : (
        <>
          <nav className="flex gap-1 overflow-x-auto rounded-full border border-border/60 bg-card/75 p-1 shadow-glass backdrop-blur-sm scrollbar-hide">
            {(
              [
                { key: "finance", label: tr("المالي والرواتب") },
                { key: "attendance", label: tr("الحضور والالتزام") },
                { key: "leaves", label: tr("الإجازات") },
                { key: "insights", label: tr("التحليل الذكي") },
              ] as { key: TabKey; label: string }[]
            ).map((item) => (
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

          {loading ? (
            <p className="flex items-center justify-center gap-2 rounded-2xl border border-border/60 bg-card/75 p-10 text-sm text-muted-foreground shadow-glass backdrop-blur-sm">
              <LoaderCircle className="h-4 w-4 animate-spin" aria-hidden />
              {tr("جاري تجهيز التقارير")}
            </p>
          ) : tab === "finance" ? (
            <section className="space-y-4">
              <div className="grid grid-cols-2 gap-3 lg:grid-cols-3">
                <KpiCard icon={<Wallet className="h-5 w-5" aria-hidden />} title={tr("الرواتب المصروفة")} value={money(finance.net)} tone="text-primary" />
                <KpiCard icon={<TrendingDown className="h-5 w-5" aria-hidden />} title={tr("الخصومات والاستقطاعات")} value={money(finance.deductions)} tone="text-destructive" />
                <KpiCard icon={<HandCoins className="h-5 w-5" aria-hidden />} title={tr("السلف القائمة")} value={money(finance.outstanding)} tone="text-warning-foreground" />
              </div>

              <Panel title={tr("توزيع المصروفات حسب الأقسام")} icon={<Building2 className="h-4 w-4" aria-hidden />}>
                {!finance.departments.length ? (
                  <EmptyState title={tr("لا توجد بيانات مالية لهذا الشهر")} detail={tr("ولد مسير الرواتب من قسم الرواتب")} />
                ) : (
                  <ul className="space-y-2.5">
                    {finance.departments.map((item) => (
                      <li key={item.name} className="rounded-xl border border-border/40 bg-background/40 p-3">
                        <div className="flex items-center justify-between gap-3 text-sm">
                          <span className="truncate font-medium text-foreground">{item.name}</span>
                          <span className="shrink-0 font-medium text-foreground">{money(item.total)}</span>
                        </div>
                        <div className="mt-2 h-1.5 overflow-hidden rounded-full bg-muted">
                          <div className="h-full rounded-full bg-primary" style={{ width: `${Math.min(100, item.share)}%` }} />
                        </div>
                        <p className="mt-1.5 text-[11px] text-muted-foreground">
                          {numberFormatter.format(item.count)} {tr("موظف —")} {decimalFormatter.format(item.share)}%
                        </p>
                      </li>
                    ))}
                  </ul>
                )}
              </Panel>
            </section>
          ) : tab === "attendance" ? (
            <section className="space-y-4">
              <div className="grid grid-cols-2 gap-3 lg:grid-cols-3">
                <KpiCard
                  icon={<ClipboardList className="h-5 w-5" aria-hidden />}
                  title={tr("نسبة الالتزام بالدوام")}
                  value={`${decimalFormatter.format(attendanceStats.compliance)}%`}
                  tone="text-success"
                />
                <KpiCard
                  icon={<Clock3 className="h-5 w-5" aria-hidden />}
                  title={tr("مجموع ساعات التأخير")}
                  value={trf("{0} ساعة", decimalFormatter.format(attendanceStats.lateMinutes / 60))}
                  tone="text-warning-foreground"
                />
                <KpiCard
                  icon={<CalendarDays className="h-5 w-5" aria-hidden />}
                  title={tr("إجمالي أيام الغياب")}
                  value={numberFormatter.format(attendanceStats.absent)}
                  tone="text-destructive"
                />
              </div>

              <Panel title={tr("أعلى الموظفين تأخيرا وغيابا")} icon={<UserRound className="h-4 w-4" aria-hidden />}>
                {!attendanceStats.top.length ? (
                  <EmptyState title={tr("لا توجد مخالفات دوام هذا الشهر")} detail={tr("سجل الحضور نظيف بالكامل")} />
                ) : (
                  <ul className="space-y-2.5">
                    {attendanceStats.top.map((item) => {
                      const employee = employeeById.get(item.id);
                      return (
                        <li key={item.id} className="flex items-center gap-3 rounded-xl border border-border/40 bg-background/40 p-3">
                          <span className="flex size-9 shrink-0 items-center justify-center rounded-full bg-primary/10 text-primary">
                            <UserRound className="h-4 w-4" aria-hidden />
                          </span>
                          <span className="min-w-0 flex-1">
                            <span className="block truncate text-sm font-medium text-foreground">{employee?.full_name ?? tr("موظف")}</span>
                            <span className="block text-[11px] text-muted-foreground">{employee?.department ?? tr("بدون قسم")}</span>
                          </span>
                          <span className="flex shrink-0 items-center gap-1.5 text-[11px]">
                            <span className="rounded-full bg-warning/20 px-2 py-0.5 text-warning-foreground">
                              {tr("تأخير")} {numberFormatter.format(item.late)}
                            </span>
                            <span className="rounded-full bg-destructive/10 px-2 py-0.5 text-destructive">
                              {tr("غياب")} {numberFormatter.format(item.absent)}
                            </span>
                          </span>
                        </li>
                      );
                    })}
                  </ul>
                )}
              </Panel>
            </section>
          ) : tab === "leaves" ? (
            <section className="space-y-4">
              <div className="grid grid-cols-2 gap-3 lg:grid-cols-4">
                <KpiCard
                  icon={<CalendarDays className="h-5 w-5" aria-hidden />}
                  title={tr("إجمالي أيام الإجازات")}
                  value={numberFormatter.format(leaveStats.totalDays)}
                  tone="text-primary"
                />
                {leaveStats.types.slice(0, 3).map((item) => (
                  <KpiCard
                    key={item.key}
                    icon={<CalendarDays className="h-5 w-5" aria-hidden />}
                    title={trf("اجازات {0}", item.label)}
                    value={trf("{0} يوم", numberFormatter.format(item.days))}
                    tone="text-foreground"
                  />
                ))}
              </div>

              <Panel title={tr("رصيد الإجازات حسب الأقسام")} icon={<Building2 className="h-4 w-4" aria-hidden />}>
                {!leaveStats.departments.length ? (
                  <EmptyState title={tr("لا توجد أقسام بعد")} detail={tr("أضف الموظفين لعرض أرصدة الإجازات")} />
                ) : (
                  <ul className="space-y-2.5">
                    {leaveStats.departments.map((item) => (
                      <li key={item.name} className="flex items-center justify-between gap-3 rounded-xl border border-border/40 bg-background/40 p-3 text-sm">
                        <span className="min-w-0">
                          <span className="block truncate font-medium text-foreground">{item.name}</span>
                          <span className="block text-[11px] text-muted-foreground">{numberFormatter.format(item.headcount)} {tr("موظف")}</span>
                        </span>
                        <span className="flex shrink-0 items-center gap-1.5 text-[11px]">
                          <span className="rounded-full bg-primary/10 px-2 py-0.5 text-primary">{tr("مستهلك")} {numberFormatter.format(item.used)}</span>
                          <span className="rounded-full bg-success/12 px-2 py-0.5 text-success">{tr("متبقي")} {numberFormatter.format(item.balance)}</span>
                        </span>
                      </li>
                    ))}
                  </ul>
                )}
              </Panel>
            </section>
          ) : (
            <InsightsTab month={month} summary={summaryForAi} />
          )}
        </>
      )}
    </div>
  );
}

function InsightsTab({ month, summary }: { month: string; summary: string }) {
  const runReport = useServerFn(generateSmartReport);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const [points, setPoints] = useState<string[]>([]);

  async function ask(prompt: string) {
    setBusy(true);
    setError("");
    try {
      const result = await runReport({ data: { month, prompt } });
      if (!result.ready) {
        setError(result.message);
        return;
      }
      if ("error" in result && result.error) {
        setError(tr("تعذر توليد التحليل حاليا. حاول مرة اخرى."));
        return;
      }
      const text = ("content" in result ? result.content : "") ?? "";
      const parsed = text
        .split("\n")
        .map((line) => line.replace(/^[\s*\-•\d.]+/, "").trim())
        .filter((line) => line.length > 2);
      setPoints(parsed.length ? parsed : [text.trim()].filter(Boolean));
    } catch {
      setError(tr("تعذر الاتصال بخدمة التحليل."));
    } finally {
      setBusy(false);
    }
  }


  return (
    <section className="space-y-4">
      <Button
        type="button"
        className="h-11 w-full rounded-xl text-sm font-medium"
        disabled={busy}
        onClick={() =>
          void ask(
            trf("{0}\n\nحلل هذه البيانات كمستشار موارد بشرية واكتب من خمس الى سبع نقاط قصيرة بالعربية بدون تشكيل تشمل اسباب الخصومات ومخاطر نقص الكادر بسبب الاجازات وتوصيات عملية لتقليل التاخير.", summary),
          )
        }
      >
        {busy ? <LoaderCircle className="h-4 w-4 animate-spin" aria-hidden /> : <FileSearch className="h-4 w-4" aria-hidden />}
        {tr("توليد تقرير ذكي")}
      </Button>

      {error ? (
        <p className="rounded-xl border border-destructive/30 bg-destructive/10 p-3 text-center text-sm leading-[1.7] text-destructive">{error}</p>
      ) : null}

      <Panel title={tr("ملاحظات وتوصيات")} icon={<FileSearch className="h-4 w-4" aria-hidden />}>
        {!points.length ? (
          <EmptyState title={tr("لا يوجد تحليل بعد")} detail={tr("اضغط زر التوليد بالاعلى للبدء")} />
        ) : (
          <ul className="space-y-2.5">
            {points.map((point, index) => (
              <li key={`${index}-${point.slice(0, 12)}`} className="flex gap-2.5 rounded-xl border border-border/40 bg-background/40 p-3">
                <span className="mt-2 size-1.5 shrink-0 rounded-full bg-primary" aria-hidden />
                <p className="text-sm font-normal leading-[1.9] text-foreground">{point}</p>
              </li>
            ))}
          </ul>
        )}
      </Panel>

      <Link
        to="/assistant"
        search={{ month }}
        className="group flex items-center gap-2.5 rounded-xl bg-[#2b5fb8] px-3 py-2 text-primary-foreground transition-transform active:translate-y-0.5 md:hover:-translate-y-0.5"
      >
        <span className="flex size-7 shrink-0 items-center justify-center rounded-lg bg-white/15 text-[12px] font-medium">
          AI
        </span>
        <span className="min-w-0 flex-1 truncate text-[13px] font-medium">{tr("المساعد الذكي")}</span>
        <ChevronLeft className="h-4 w-4 shrink-0 text-primary-foreground/80" aria-hidden />
      </Link>


    </section>
  );
}

function Panel({ title, icon, children }: { title: string; icon: ReactNode; children: ReactNode }) {
  return (
    <div className="rounded-2xl border border-border/40 bg-card/75 p-4 shadow-glass backdrop-blur-sm">
      <div className="mb-3 flex items-center gap-2">
        <span className="flex size-7 items-center justify-center rounded-full bg-muted text-muted-foreground">{icon}</span>
        <h3 className="text-sm font-medium text-foreground">{title}</h3>
      </div>
      {children}
    </div>
  );
}

function KpiCard({ icon, title, value, tone }: { icon: ReactNode; title: string; value: string; tone: string }) {
  return (
    <div className="rounded-2xl border border-border/40 bg-card/75 px-3 py-2 shadow-glass backdrop-blur-sm">
      <div className="flex items-center gap-2">
        <span className={cn("flex size-6 shrink-0 items-center justify-center rounded-full bg-muted [&_svg]:size-3.5", tone)}>{icon}</span>
        <p className="truncate text-[11px] font-normal leading-tight text-muted-foreground">{title}</p>
      </div>
      <p className={cn("mt-1 truncate text-sm font-medium leading-tight", tone)}>{value}</p>
    </div>
  );
}

function EmptyState({ title, detail }: { title: string; detail: string }) {
  return (
    <div className="rounded-xl border border-dashed border-border/60 bg-background/40 p-8 text-center">
      <span className="mx-auto flex size-12 items-center justify-center rounded-full bg-muted text-muted-foreground">
        <ClipboardList className="h-6 w-6" aria-hidden />
      </span>
      <p className="mt-3 text-sm font-medium text-foreground">{title}</p>
      <p className="mt-1 text-xs leading-[1.8] text-muted-foreground">{detail}</p>
    </div>
  );
}
