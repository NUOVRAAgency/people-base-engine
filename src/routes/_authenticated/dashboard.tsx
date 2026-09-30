import { createFileRoute, Link, useNavigate } from "@tanstack/react-router";
import {
  Check,
  CalendarCheck,
  LoaderCircle,
  Plane,
  Users,
  UserRound,
  Wallet,
  X,
} from "lucide-react";
import { useCallback, useEffect, useMemo, useState, type ReactNode } from "react";
import {
  Area,
  AreaChart,
  CartesianGrid,
  Cell,
  Line,
  LineChart,
  Pie,
  PieChart,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from "recharts";
import { useCurrentUser } from "@/hooks/use-current-user";
import { supabase } from "@/integrations/supabase/client";
import { cn } from "@/lib/utils";

import { tr, trf, getLocale } from "@/lib/i18n";
export const Route = createFileRoute("/_authenticated/dashboard")({
  head: () => ({
    meta: [
      { title: tr("الرئيسية | نظام الموارد البشرية") },
      { name: "description", content: tr("لوحة تحكم قيادية تعرض الحضور والاقسام والرواتب والطلبات المعلقة") },
      { property: "og:title", content: tr("الرئيسية | نظام الموارد البشرية") },
      { property: "og:description", content: tr("لوحة تحكم قيادية تعرض الحضور والاقسام والرواتب والطلبات المعلقة") },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary_large_image" },
    ],
  }),
  component: DashboardPage,
});

const dateFormatter = new Intl.DateTimeFormat(getLocale(), {
  weekday: "long",
  day: "numeric",
  month: "long",
  year: "numeric",
});
const monthFormatter = new Intl.DateTimeFormat(getLocale(), { month: "long", year: "numeric" });
const weekdayFormatter = new Intl.DateTimeFormat(getLocale(), { weekday: "short" });
const numberFormatter = new Intl.NumberFormat("en-US");

const CHART_COLORS = ["#1f6bff", "#7c5cff", "#00b8a9", "#ff7a45", "#f2427f", "#17b26a", "#12a3e0", "#f5b544"];

const YEAR_MONTHS = [tr("يناير"), tr("فبراير"), tr("مارس"), tr("ابريل"), tr("مايو"), tr("يونيو"), tr("يوليو"), tr("اغسطس"), tr("سبتمبر"), tr("اكتوبر"), tr("نوفمبر"), tr("ديسمبر")];


const LEAVE_LABELS: Record<string, string> = {
  annual: tr("سنوية"),
  sick: tr("مرضية"),
  unpaid: tr("بدون راتب"),
  emergency: tr("طارئة"),
  other: tr("اخرى"),
};

const PAYROLL_STATUS: Record<string, string> = {
  draft: tr("مسودة"),
  review: tr("بانتظار الاعتماد"),
  approved: tr("معتمد"),
};

function pad(value: number) {
  return String(value).padStart(2, "0");
}
function dayKeyOf(date: Date) {
  return `${date.getFullYear()}-${pad(date.getMonth() + 1)}-${pad(date.getDate())}`;
}
function monthKeyOf(date: Date) {
  return `${date.getFullYear()}-${pad(date.getMonth() + 1)}-01`;
}
function daysBetween(start: string, end: string) {
  const a = new Date(`${start}T00:00:00`).getTime();
  const b = new Date(`${end}T00:00:00`).getTime();
  if (Number.isNaN(a) || Number.isNaN(b)) return 1;
  return Math.max(1, Math.round((b - a) / 86400000) + 1);
}

type EmployeeRow = { id: string; full_name: string; department: string | null; position: string | null };
type AttendanceRow = { employee_id: string; status: string; date: string };
type LeaveRow = {
  id: string;
  employee_id: string;
  leave_type: string;
  status: string;
  start_date: string;
  end_date: string;
};
type PayrollRow = { employee_id: string; net_salary: number; status: string };

function DashboardPage() {
  const { isAdmin, loading: roleLoading } = useCurrentUser();
  const navigate = useNavigate();
  const [pressed, setPressed] = useState<string | null>(null);
  const openSection = useCallback((to: "/employees" | "/attendance" | "/leaves" | "/payroll") => {
    setPressed(to);
    window.setTimeout(() => {
      setPressed(null);
      void navigate({ to });
    }, 280);
  }, [navigate]);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState<string | null>(null);
  const [employees, setEmployees] = useState<EmployeeRow[]>([]);
  const [attendance, setAttendance] = useState<AttendanceRow[]>([]);
  const [leaves, setLeaves] = useState<LeaveRow[]>([]);
  const [payroll, setPayroll] = useState<PayrollRow[]>([]);
  const [yearPayroll, setYearPayroll] = useState<{ month: string; net_salary: number }[]>([]);


  const today = useMemo(() => new Date(), []);
  const dayKey = dayKeyOf(today);
  const month = monthKeyOf(today);
  const weekStartKey = useMemo(() => {
    const d = new Date(today);
    d.setDate(d.getDate() - 6);
    return dayKeyOf(d);
  }, [today]);

  const load = useCallback(async () => {
    setLoading(true);
    const year = Number(month.slice(0, 4));
    const [employeesResult, attendanceResult, leavesResult, payrollResult, yearPayrollResult] = await Promise.all([
      supabase.from("employees").select("id,full_name,department,position").eq("status", "active").order("full_name"),
      supabase.from("attendance").select("employee_id,status,date").gte("date", weekStartKey).lte("date", dayKey),
      supabase
        .from("leave_requests")
        .select("id,employee_id,leave_type,status,start_date,end_date")
        .order("created_at", { ascending: false })
        .limit(30),
      supabase.from("payroll").select("employee_id,net_salary,status").eq("month", month),
      supabase
        .from("payroll")
        .select("month,net_salary")
        .gte("month", `${year}-01-01`)
        .lte("month", `${year}-12-31`),
    ]);
    setEmployees((employeesResult.data ?? []) as EmployeeRow[]);
    setAttendance((attendanceResult.data ?? []) as AttendanceRow[]);
    setLeaves((leavesResult.data ?? []) as LeaveRow[]);
    setPayroll((payrollResult.data ?? []) as PayrollRow[]);
    setYearPayroll((yearPayrollResult.data ?? []) as { month: string; net_salary: number }[]);
    setLoading(false);
  }, [dayKey, weekStartKey, month]);


  useEffect(() => {
    void load();
  }, [load]);

  const employeeById = useMemo(() => {
    const map = new Map<string, EmployeeRow>();
    for (const item of employees) map.set(item.id, item);
    return map;
  }, [employees]);

  const todayRows = attendance.filter((row) => row.date === dayKey);
  const presentToday = todayRows.filter((row) => row.status === "present" || row.status === "late").length;
  const pendingLeaves = leaves.filter((row) => row.status === "pending");
  const onLeaveToday = leaves.filter(
    (row) => row.status === "approved" && row.start_date <= dayKey && row.end_date >= dayKey,
  ).length;

  const departments = useMemo(() => {
    const map = new Map<string, number>();
    for (const item of employees) {
      const key = item.department?.trim() || tr("بدون قسم");
      map.set(key, (map.get(key) ?? 0) + 1);
    }
    return [...map.entries()]
      .map(([name, count]) => ({ name, count }))
      .sort((a, b) => b.count - a.count)
      .slice(0, 5);
  }, [employees]);


  const donutData = departments;
  const donutTotal = useMemo(() => donutData.reduce((sum, item) => sum + item.count, 0), [donutData]);

  const yearSeries = useMemo(() => {
    const totals = new Array(12).fill(0) as number[];
    for (const row of yearPayroll) {
      const index = Number(String(row.month).slice(5, 7)) - 1;
      if (index >= 0 && index < 12) totals[index] = (totals[index] ?? 0) + Number(row.net_salary ?? 0);
    }
    return YEAR_MONTHS.map((label, index) => ({ label, value: Math.round(totals[index] ?? 0) }));
  }, [yearPayroll]);

  const hasYearPayroll = useMemo(() => yearSeries.some((point) => point.value > 0), [yearSeries]);



  const weekSeries = useMemo(() => {
    const days: { label: string; key: string; حضور: number; إجازات: number }[] = [];
    for (let i = 6; i >= 0; i -= 1) {
      const d = new Date(today);
      d.setDate(d.getDate() - i);
      const key = dayKeyOf(d);
      days.push({ label: weekdayFormatter.format(d), key, حضور: 0, إجازات: 0 });
    }
    for (const row of attendance) {
      const day = days.find((item) => item.key === row.date);
      if (day && (row.status === "present" || row.status === "late")) day.حضور += 1;
    }
    for (const row of leaves) {
      if (row.status !== "approved") continue;
      for (const day of days) {
        if (row.start_date <= day.key && row.end_date >= day.key) day.إجازات += 1;
      }
    }
    return days;
  }, [attendance, leaves, today]);

  const totalNet = payroll.reduce((sum, row) => sum + Number(row.net_salary ?? 0), 0);
  const approvedNet = payroll
    .filter((row) => row.status === "approved")
    .reduce((sum, row) => sum + Number(row.net_salary ?? 0), 0);
  const payrollStatus = payroll[0]?.status ? (PAYROLL_STATUS[payroll[0].status] ?? tr("مسودة")) : tr("لم يولد بعد");
  const disbursedRatio = totalNet > 0 ? Math.round((approvedNet / totalNet) * 100) : 0;

  const decideLeave = useCallback(
    async (id: string, status: "approved" | "rejected") => {
      setSaving(id);
      await supabase.from("leave_requests").update({ status }).eq("id", id);
      setSaving(null);
      await load();
    },
    [load],
  );

  if (loading) {
    return (
      <p className="flex items-center justify-center gap-2 rounded-2xl border border-border/60 bg-card/75 p-10 text-sm text-muted-foreground shadow-glass backdrop-blur-sm">
        <LoaderCircle className="h-4 w-4 animate-spin" aria-hidden />
        {tr("جاري تجهيز اللوحة")}
      </p>
    );
  }

  return (
    <div className="mx-auto w-full max-w-7xl space-y-3 pb-6">
      <header className="rounded-2xl border border-border/40 bg-card/75 px-3 py-2 shadow-glass backdrop-blur-sm">
        <div className="min-w-0">
          <h2 className="truncate text-base font-medium leading-[1.6] text-foreground md:text-lg">{tr("أهلا بك")}</h2>
          <p className="mt-0.5 truncate text-[12px] leading-[1.7] text-muted-foreground md:text-sm">
            {dateFormatter.format(today)}
          </p>
        </div>
      </header>

      <section className="grid grid-cols-2 gap-2.5 lg:grid-cols-4">
        <KpiCard
          title={tr("إجمالي الموظفين")}
          value={numberFormatter.format(employees.length)}
          icon={<Users className="h-3 w-3" aria-hidden />}
          to="/employees"
          pressed={pressed === "/employees"}
          onPress={() => openSection("/employees")}
        />
        <KpiCard
          title={tr("الحاضرون اليوم")}
          value={numberFormatter.format(presentToday)}
          icon={<CalendarCheck className="h-3 w-3" aria-hidden />}
          to="/attendance"
          pressed={pressed === "/attendance"}
          onPress={() => openSection("/attendance")}
        />
        <KpiCard
          title={tr("في إجازة اليوم")}
          value={numberFormatter.format(onLeaveToday)}
          icon={<Plane className="h-3 w-3" aria-hidden />}
          to="/leaves"
          pressed={pressed === "/leaves"}
          onPress={() => openSection("/leaves")}
        />
        <KpiCard
          title={monthFormatter.format(new Date(`${month}T00:00:00`))}
          value={payrollStatus}
          icon={<Wallet className="h-3 w-3" aria-hidden />}
          to={isAdmin ? "/payroll" : undefined}
          compact
          pressed={pressed === "/payroll"}
          onPress={isAdmin ? () => openSection("/payroll") : undefined}
        />
      </section>

      <div className="grid gap-3 lg:grid-cols-2">
        <Panel title={tr("توزيع الموظفين حسب الأقسام")} action={departments.length > 0 ? tr("الاقسام") : tr("بيانات توضيحية")}>
          <div className="relative mx-auto h-[210px] w-full max-w-[280px]" dir="ltr">
            <ResponsiveContainer width="100%" height="100%">
              <PieChart>
                <Pie
                  data={donutData}
                  dataKey="count"
                  nameKey="name"
                  innerRadius="62%"
                  outerRadius="92%"
                  paddingAngle={2}
                  cornerRadius={6}
                  stroke="none"
                >
                  {donutData.map((item, index) => (
                    <Cell key={item.name} fill={CHART_COLORS[index % CHART_COLORS.length]} />
                  ))}
                </Pie>
                <Tooltip
                  formatter={(value: number, name: string) => [
                    trf("{0} موظف ({1}%)", numberFormatter.format(value), Math.round((value / donutTotal) * 100)),
                    name,
                  ]}
                  contentStyle={{
                    borderRadius: 14,
                    border: "1px solid rgba(0,0,0,0.06)",
                    fontSize: 12,
                    direction: "rtl",
                  }}
                />
              </PieChart>
            </ResponsiveContainer>
            <div className="pointer-events-none absolute inset-0 flex flex-col items-center justify-center">
              <span className="text-[11px] text-muted-foreground">{tr("إجمالي الموظفين")}</span>
              <span className="text-2xl font-medium leading-tight text-foreground">
                {numberFormatter.format(donutTotal)}
              </span>
            </div>
          </div>
          <ul className="mt-3 grid grid-cols-2 gap-x-3 gap-y-1.5">
            {donutData.map((item, index) => (
              <li key={item.name} className="flex items-center gap-1.5">
                <span
                  className="size-2 shrink-0 rounded-full"
                  style={{ backgroundColor: CHART_COLORS[index % CHART_COLORS.length] }}
                />
                <span className="min-w-0 flex-1 truncate text-[11px] text-muted-foreground">{item.name}</span>
                <span className="shrink-0 text-[11px] font-medium text-foreground">
                  {donutTotal > 0 ? Math.round((item.count / donutTotal) * 100) : 0}%
                </span>
              </li>
            ))}
          </ul>
        </Panel>

        <Panel title={tr("اتجاه صرف الرواتب خلال السنة")} action={tr("ر.ي")}>
          <div className="mt-3 h-[252px] w-full" dir="ltr">
            <ResponsiveContainer width="100%" height="100%">
              <AreaChart data={yearSeries} margin={{ top: 12, right: 6, left: 0, bottom: 8 }}>
                <defs>
                  <linearGradient id="areaTrend" x1="0" y1="0" x2="0" y2="1">
                    <stop offset="0%" stopColor="#00b8a9" stopOpacity={0.35} />
                    <stop offset="100%" stopColor="#00b8a9" stopOpacity={0.02} />
                  </linearGradient>
                </defs>
                <CartesianGrid stroke="rgba(148, 163, 184, 0.4)" strokeDasharray="4 4" vertical={false} />
                <XAxis
                  dataKey="label"
                  tickLine={false}
                  axisLine={false}
                  interval="preserveStartEnd"
                  minTickGap={8}
                  tick={{ fontSize: 9, fill: "#9aa4b4", dy: 8 }}
                />
                <YAxis
                  tickLine={false}
                  axisLine={false}
                  width={48}
                  tick={{ fontSize: 10, fill: "#9aa4b4" }}
                  tickFormatter={(value: number) => numberFormatter.format(Math.round(value / 1000)) + "k"}
                />
                <Tooltip
                  cursor={{ stroke: "rgba(0,184,169,0.35)", strokeWidth: 1 }}
                  formatter={(value: number) => [trf("{0} ر.ي", numberFormatter.format(value)), tr("الرواتب")]}
                  contentStyle={{
                    borderRadius: 14,
                    border: "1px solid rgba(0,0,0,0.06)",
                    fontSize: 12,
                    direction: "rtl",
                  }}
                />
                <Area
                  type="monotone"
                  dataKey="value"
                  stroke="#00b8a9"
                  strokeWidth={2.5}
                  fill="url(#areaTrend)"
                  activeDot={{ r: 4, strokeWidth: 0 }}
                />
              </AreaChart>
            </ResponsiveContainer>
          </div>
        </Panel>
      </div>

      <div className="grid gap-3 lg:grid-cols-2">
        <Panel title={tr("الحضور مقابل الإجازات")} action={tr("آخر 7 أيام")}>
          <div className="mb-2 flex items-center gap-4">
            <Legend color="#1f6bff" label={tr("الحضور")} />
            <Legend color="#9dc0ff" label={tr("الإجازات")} />
          </div>
          <div className="h-[196px] w-full" dir="ltr">
            <ResponsiveContainer width="100%" height="100%">
              <LineChart data={weekSeries} margin={{ top: 8, right: 8, left: 0, bottom: 4 }}>
                <CartesianGrid stroke="rgba(148, 163, 184, 0.35)" strokeDasharray="4 4" vertical={false} />
                <XAxis dataKey="label" tickLine={false} axisLine={false} tick={{ fontSize: 11, fill: "#7a8699", dy: 6 }} />
                <YAxis
                  tickLine={false}
                  axisLine={false}
                  width={32}
                  allowDecimals={false}
                  tick={{ fontSize: 10, fill: "#9aa4b4" }}
                />
                <Tooltip contentStyle={{ borderRadius: 12, border: "1px solid rgba(0,0,0,0.06)", fontSize: 12 }} />
                <Line type="monotone" dataKey={tr("حضور")} stroke="#1f6bff" strokeWidth={2.5} dot={false} />
                <Line type="monotone" dataKey={tr("إجازات")} stroke="#9dc0ff" strokeWidth={2.5} dot={false} />
              </LineChart>
            </ResponsiveContainer>
          </div>
        </Panel>

        <Panel title={tr("صرف الرواتب")} action={monthFormatter.format(new Date(`${month}T00:00:00`))}>
          <div className="relative mx-auto h-[150px] w-full max-w-[260px]" dir="ltr">
            <ResponsiveContainer width="100%" height="100%">
              <AreaChart data={weekSeries} margin={{ top: 10, right: 0, left: 0, bottom: 0 }}>
                <defs>
                  <linearGradient id="areaBlue" x1="0" y1="0" x2="0" y2="1">
                    <stop offset="0%" stopColor="#1f6bff" stopOpacity={0.35} />
                    <stop offset="100%" stopColor="#1f6bff" stopOpacity={0} />
                  </linearGradient>
                </defs>
                <Area type="monotone" dataKey={tr("حضور")} stroke="#1f6bff" strokeWidth={2} fill="url(#areaBlue)" />
              </AreaChart>
            </ResponsiveContainer>
            <div className="pointer-events-none absolute inset-0 flex flex-col items-center justify-center">
              <span className="text-xl font-medium text-foreground">{numberFormatter.format(totalNet)} {tr("ر.ي")}</span>
              <span className="mt-0.5 text-[11px] text-muted-foreground">{tr("إجمالي المبلغ")}</span>
            </div>
          </div>
          <div className="mt-2 space-y-1.5">
            <div className="flex items-center justify-between text-[12px]">
              <span className="text-muted-foreground">{tr("المصروف فعليا")}</span>
              <span className="font-medium text-foreground">{numberFormatter.format(approvedNet)} {tr("ر.ي")}</span>
            </div>
            <div className="h-1.5 w-full overflow-hidden rounded-full bg-muted">
              <div className="h-full rounded-full bg-primary" style={{ width: `${disbursedRatio}%` }} />
            </div>
            <p className="text-[11px] text-muted-foreground">{disbursedRatio}{tr("% من إجمالي المسير")}</p>
          </div>
        </Panel>
      </div>

      <Panel title={tr("طلبات الإجازة المعلقة")} action={trf("{0} طلب", pendingLeaves.length)}>
        {pendingLeaves.length === 0 ? (
          <Empty text={tr("لا توجد طلبات معلقة")} />
        ) : (
          <ul className="space-y-2">
            {pendingLeaves.slice(0, 5).map((row) => {
              const employee = employeeById.get(row.employee_id);
              return (
                <li
                  key={row.id}
                  className="flex items-center gap-3 rounded-xl border border-border/40 bg-background/40 p-2.5"
                >
                  <span className="flex size-9 shrink-0 items-center justify-center rounded-full bg-muted text-muted-foreground">
                    <UserRound className="h-4 w-4" aria-hidden />
                  </span>
                  <span className="min-w-0 flex-1">
                    <span className="block truncate text-[13px] font-medium text-foreground">
                      {employee?.full_name ?? tr("موظف")}
                    </span>
                    <span className="block truncate text-[11px] leading-[1.7] text-muted-foreground">
                      {employee?.position || tr("بدون مسمى")} · {LEAVE_LABELS[row.leave_type] ?? tr("اجازة")} ·{" "}
                      {numberFormatter.format(daysBetween(row.start_date, row.end_date))} {tr("أيام")}
                    </span>
                  </span>
                  <span className="hidden shrink-0 rounded-md bg-amber-500/10 px-2 py-0.5 text-[11px] text-amber-600 sm:block">
                    {tr("معلق")}
                  </span>
                  {isAdmin ? (
                    <span className="flex shrink-0 items-center gap-1.5">
                      <button
                        type="button"
                        disabled={saving === row.id}
                        onClick={() => void decideLeave(row.id, "approved")}
                        className="flex size-8 items-center justify-center rounded-full bg-emerald-500/10 text-emerald-600 transition-colors hover:bg-emerald-500/20 disabled:opacity-50"
                        aria-label={tr("اعتماد")}
                      >
                        <Check className="h-4 w-4" aria-hidden />
                      </button>
                      <button
                        type="button"
                        disabled={saving === row.id}
                        onClick={() => void decideLeave(row.id, "rejected")}
                        className="flex size-8 items-center justify-center rounded-full bg-destructive/10 text-destructive transition-colors hover:bg-destructive/20 disabled:opacity-50"
                        aria-label={tr("رفض")}
                      >
                        <X className="h-4 w-4" aria-hidden />
                      </button>
                    </span>
                  ) : null}
                </li>
              );
            })}
          </ul>
        )}
        <Link
          to="/leaves"
          className="mt-2.5 block rounded-xl border border-border/40 bg-background/40 py-2 text-center text-[12px] text-primary transition-colors hover:bg-muted/60"
        >
          {tr("عرض كل الطلبات")}
        </Link>
      </Panel>

      {!roleLoading && !isAdmin ? (
        <p className="rounded-2xl border border-border/40 bg-card/75 p-4 text-center text-xs leading-[1.8] text-muted-foreground shadow-glass backdrop-blur-sm">
          {tr("بعض الاجراءات متاحة لمدير النظام فقط.")}
        </p>
      ) : null}
    </div>
  );
}

function KpiCard({
  icon,
  title,
  value,
  to,
  pressed,
  onPress,
  compact,
}: {
  icon: ReactNode;
  title: string;
  value: string;
  to?: string | undefined;
  pressed?: boolean | undefined;
  onPress?: (() => void) | undefined;
  compact?: boolean | undefined;
}) {
  const content = (
    <>
      <div className="flex items-center gap-1.5">
        <span
          className={cn(
            "flex size-6 shrink-0 items-center justify-center [&_svg]:size-3",
            pressed ? "bg-primary/10 text-primary" : "bg-white/15 text-white",
          )}
        >
          {icon}
        </span>
        <p className={cn("truncate text-[11px] font-semibold", pressed ? "text-primary" : "text-white")}>
          {title}
        </p>
      </div>
      <p
        className={cn(
          "mt-1 truncate font-semibold leading-tight",
          compact ? "text-sm" : "text-lg",
          pressed ? "text-primary" : "text-white",
        )}
      >
        {value}
      </p>
    </>
  );

  const classes = cn(
    "rounded-2xl border p-2.5 text-start shadow-glass backdrop-blur-sm transition-colors duration-150",
    pressed ? "border-border/40 bg-card/75" : "border-primary bg-primary",
  );

  if (!to || !onPress) {
    return <div className={classes}>{content}</div>;
  }
  return (
    <button type="button" className={classes} onClick={onPress} aria-label={title}>
      {content}
    </button>
  );
}

function Panel({ title, action, children }: { title: string; action?: string; children: ReactNode }) {
  return (
    <section className="rounded-2xl border border-border/40 bg-card/75 p-4 shadow-glass backdrop-blur-sm">
      <div className="mb-3 flex items-center justify-between gap-2">
        <h3 className="truncate text-sm font-medium text-foreground">{title}</h3>
        {action ? <span className="shrink-0 text-[11px] text-muted-foreground">{action}</span> : null}
      </div>
      {children}
    </section>
  );
}

function Legend({ color, label }: { color: string; label: string }) {
  return (
    <span className="flex items-center gap-1.5 text-[11px] text-muted-foreground">
      <span className="size-2 rounded-full" style={{ backgroundColor: color }} />
      {label}
    </span>
  );
}

function Empty({ text }: { text: string }) {
  return (
    <div className="rounded-xl border border-dashed border-border/60 bg-background/40 p-8 text-center">
      <span className="mx-auto flex size-10 items-center justify-center rounded-full bg-muted text-muted-foreground">
        <CalendarCheck className="h-4 w-4" aria-hidden />
      </span>
      <p className="mt-2 text-[13px] text-muted-foreground">{text}</p>
    </div>
  );
}
