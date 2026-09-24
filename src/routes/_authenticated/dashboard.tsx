import { createFileRoute, Link } from "@tanstack/react-router";
import {
  Check,
  CalendarCheck,
  CheckCircle2,
  Clock3,
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
  Bar,
  BarChart,
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

export const Route = createFileRoute("/_authenticated/dashboard")({
  head: () => ({
    meta: [
      { title: "الرئيسية | نظام الموارد البشرية" },
      { name: "description", content: "لوحة تحكم قيادية تعرض الحضور والاقسام والرواتب والطلبات المعلقة" },
      { property: "og:title", content: "الرئيسية | نظام الموارد البشرية" },
      { property: "og:description", content: "لوحة تحكم قيادية تعرض الحضور والاقسام والرواتب والطلبات المعلقة" },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary_large_image" },
    ],
  }),
  component: DashboardPage,
});

const dateFormatter = new Intl.DateTimeFormat("ar-YE-u-nu-latn", {
  weekday: "long",
  day: "numeric",
  month: "long",
  year: "numeric",
});
const monthFormatter = new Intl.DateTimeFormat("ar-YE-u-nu-latn", { month: "long", year: "numeric" });
const weekdayFormatter = new Intl.DateTimeFormat("ar-YE-u-nu-latn", { weekday: "short" });
const numberFormatter = new Intl.NumberFormat("en-US");

const CHART_COLORS = ["#1f6bff", "#4b8dff", "#86b2ff", "#b9d2ff", "#dbe7ff"];

const LEAVE_LABELS: Record<string, string> = {
  annual: "سنوية",
  sick: "مرضية",
  unpaid: "بدون راتب",
  emergency: "طارئة",
  other: "اخرى",
};

const PAYROLL_STATUS: Record<string, string> = {
  draft: "مسودة",
  review: "بانتظار الاعتماد",
  approved: "معتمد",
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
  const { fullName, isAdmin, loading: roleLoading } = useCurrentUser();
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState<string | null>(null);
  const [employees, setEmployees] = useState<EmployeeRow[]>([]);
  const [attendance, setAttendance] = useState<AttendanceRow[]>([]);
  const [leaves, setLeaves] = useState<LeaveRow[]>([]);
  const [payroll, setPayroll] = useState<PayrollRow[]>([]);

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
    const [employeesResult, attendanceResult, leavesResult, payrollResult] = await Promise.all([
      supabase.from("employees").select("id,full_name,department,position").eq("status", "active").order("full_name"),
      supabase.from("attendance").select("employee_id,status,date").gte("date", weekStartKey).lte("date", dayKey),
      supabase
        .from("leave_requests")
        .select("id,employee_id,leave_type,status,start_date,end_date")
        .order("created_at", { ascending: false })
        .limit(30),
      supabase.from("payroll").select("employee_id,net_salary,status").eq("month", month),
    ]);
    setEmployees((employeesResult.data ?? []) as EmployeeRow[]);
    setAttendance((attendanceResult.data ?? []) as AttendanceRow[]);
    setLeaves((leavesResult.data ?? []) as LeaveRow[]);
    setPayroll((payrollResult.data ?? []) as PayrollRow[]);
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
      const key = item.department?.trim() || "بدون قسم";
      map.set(key, (map.get(key) ?? 0) + 1);
    }
    return [...map.entries()]
      .map(([name, count]) => ({ name, count }))
      .sort((a, b) => b.count - a.count)
      .slice(0, 5);
  }, [employees]);

  const salaryByDepartment = useMemo(() => {
    const map = new Map<string, number>();
    for (const row of payroll) {
      const key = employeeById.get(row.employee_id)?.department?.trim() || "بدون قسم";
      map.set(key, (map.get(key) ?? 0) + Number(row.net_salary ?? 0));
    }
    return [...map.entries()]
      .map(([name, total]) => ({ name, total }))
      .sort((a, b) => b.total - a.total)
      .slice(0, 6);
  }, [payroll, employeeById]);

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
  const payrollStatus = payroll[0]?.status ? (PAYROLL_STATUS[payroll[0].status] ?? "مسودة") : "لم يولد بعد";
  const disbursedRatio = totalNet > 0 ? Math.round((approvedNet / totalNet) * 100) : 0;
  const attendanceRate = employees.length > 0 ? Math.round((presentToday / employees.length) * 100) : 0;

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
        جاري تجهيز اللوحة
      </p>
    );
  }

  return (
    <div className="mx-auto w-full max-w-7xl space-y-3 pb-6">
      <header className="grid grid-cols-[minmax(0,1fr)_auto] items-center gap-3 rounded-2xl border border-border/40 bg-card/75 p-4 shadow-glass backdrop-blur-sm">
        <div className="min-w-0">
          <h2 className="truncate text-lg font-medium leading-[1.6] text-foreground md:text-xl">
            أهلا بك، {/[\u0600-\u06ff]/.test(fullName) ? fullName : "مدير النظام"} 👋
          </h2>
          <p className="mt-0.5 truncate text-[12px] leading-[1.7] text-muted-foreground md:text-sm">
            {dateFormatter.format(today)}
          </p>
        </div>
        <span className="flex size-10 shrink-0 items-center justify-center rounded-full bg-muted text-muted-foreground">
          <UserRound className="h-5 w-5" aria-hidden />
        </span>
      </header>

      <div className="grid gap-3 lg:grid-cols-[minmax(0,1.15fr)_minmax(0,1fr)]">
        <section className="grid grid-cols-2 gap-3">
          <FeatureCard
            title="إجمالي الموظفين"
            value={numberFormatter.format(employees.length)}
            caption="الموظفون النشطون"
          />
          <StatCard
            icon={<CheckCircle2 className="h-4 w-4" aria-hidden />}
            title="الحاضرون اليوم"
            value={numberFormatter.format(presentToday)}
            caption={`نسبة الحضور ${attendanceRate}%`}
          />
          <StatCard
            icon={<Plane className="h-4 w-4" aria-hidden />}
            title="في إجازة اليوم"
            value={numberFormatter.format(onLeaveToday)}
            caption="إجازات معتمدة سارية"
          />
          <StatCard
            icon={<Wallet className="h-4 w-4" aria-hidden />}
            title={monthFormatter.format(new Date(`${month}T00:00:00`))}
            value={payrollStatus}
            caption="حالة مسير الرواتب"
            compact
          />
        </section>

        <Panel title="نظرة عامة على الأقسام" action="اليوم">
          {departments.length === 0 ? (
            <Empty text="لا يوجد موظفون بعد" />
          ) : (
            <div className="grid items-center gap-3 sm:grid-cols-[minmax(0,150px)_minmax(0,1fr)]">
              <div className="relative mx-auto h-[150px] w-[150px]">
                <ResponsiveContainer width="100%" height="100%">
                  <PieChart>
                    <Pie
                      data={departments}
                      dataKey="count"
                      nameKey="name"
                      innerRadius={52}
                      outerRadius={72}
                      paddingAngle={2}
                      stroke="none"
                    >
                      {departments.map((item, index) => (
                        <Cell key={item.name} fill={CHART_COLORS[index % CHART_COLORS.length]} />
                      ))}
                    </Pie>
                  </PieChart>
                </ResponsiveContainer>
                <div className="pointer-events-none absolute inset-0 flex flex-col items-center justify-center">
                  <span className="text-[10px] text-muted-foreground">إجمالي الموظفين</span>
                  <span className="text-xl font-medium text-foreground">{numberFormatter.format(employees.length)}</span>
                </div>
              </div>
              <ul className="space-y-1.5">
                {departments.map((item, index) => {
                  const percent = employees.length > 0 ? Math.round((item.count / employees.length) * 100) : 0;
                  return (
                    <li
                      key={item.name}
                      className="flex items-center gap-2 border-b border-border/40 pb-1.5 last:border-0 last:pb-0"
                    >
                      <span
                        className="h-7 w-1 shrink-0 rounded-full"
                        style={{ backgroundColor: CHART_COLORS[index % CHART_COLORS.length] }}
                      />
                      <span className="min-w-0 flex-1">
                        <span className="block truncate text-[12px] text-foreground">{item.name}</span>
                        <span className="block text-[11px] text-muted-foreground">{numberFormatter.format(item.count)}</span>
                      </span>
                      <span className="shrink-0 rounded-md bg-primary/10 px-2 py-0.5 text-[11px] font-medium text-primary">
                        {percent}%
                      </span>
                    </li>
                  );
                })}
              </ul>
            </div>
          )}
        </Panel>
      </div>

      <div className="grid gap-3 lg:grid-cols-2">
        <Panel title="توزيع الرواتب حسب الأقسام" action={monthFormatter.format(new Date(`${month}T00:00:00`))}>
          {salaryByDepartment.length === 0 ? (
            <Empty text="لا يوجد مسير رواتب لهذا الشهر" />
          ) : (
            <div className="h-[220px] w-full" dir="ltr">
              <ResponsiveContainer width="100%" height="100%">
                <BarChart data={salaryByDepartment} margin={{ top: 8, right: 8, left: 0, bottom: 0 }}>
                  <defs>
                    <linearGradient id="barBlue" x1="0" y1="0" x2="0" y2="1">
                      <stop offset="0%" stopColor="#1f6bff" stopOpacity={0.95} />
                      <stop offset="100%" stopColor="#1f6bff" stopOpacity={0.25} />
                    </linearGradient>
                  </defs>
                  <XAxis dataKey="name" tickLine={false} axisLine={false} tick={{ fontSize: 11, fill: "#7a8699" }} />
                  <YAxis
                    tickLine={false}
                    axisLine={false}
                    width={54}
                    tick={{ fontSize: 10, fill: "#9aa4b4" }}
                    tickFormatter={(value: number) => numberFormatter.format(value)}
                  />
                  <Tooltip
                    cursor={{ fill: "rgba(31,107,255,0.06)" }}
                    formatter={(value: number) => [`${numberFormatter.format(value)} ر.ي`, "الإجمالي"]}
                    contentStyle={{ borderRadius: 12, border: "1px solid rgba(0,0,0,0.06)", fontSize: 12 }}
                  />
                  <Bar dataKey="total" fill="url(#barBlue)" radius={[8, 8, 0, 0]} maxBarSize={56} />
                </BarChart>
              </ResponsiveContainer>
            </div>
          )}
        </Panel>

        <Panel title="الحضور مقابل الإجازات" action="آخر 7 أيام">
          <div className="mb-2 flex items-center gap-4">
            <Legend color="#1f6bff" label="الحضور" />
            <Legend color="#9dc0ff" label="الإجازات" />
          </div>
          <div className="h-[196px] w-full" dir="ltr">
            <ResponsiveContainer width="100%" height="100%">
              <LineChart data={weekSeries} margin={{ top: 8, right: 8, left: 0, bottom: 0 }}>
                <XAxis dataKey="label" tickLine={false} axisLine={false} tick={{ fontSize: 11, fill: "#7a8699" }} />
                <YAxis
                  tickLine={false}
                  axisLine={false}
                  width={32}
                  allowDecimals={false}
                  tick={{ fontSize: 10, fill: "#9aa4b4" }}
                />
                <Tooltip contentStyle={{ borderRadius: 12, border: "1px solid rgba(0,0,0,0.06)", fontSize: 12 }} />
                <Line type="monotone" dataKey="حضور" stroke="#1f6bff" strokeWidth={2.5} dot={false} />
                <Line type="monotone" dataKey="إجازات" stroke="#9dc0ff" strokeWidth={2.5} dot={false} />
              </LineChart>
            </ResponsiveContainer>
          </div>
        </Panel>
      </div>

      <div className="grid gap-3 lg:grid-cols-[minmax(0,1.3fr)_minmax(0,1fr)]">
        <Panel title="طلبات الإجازة المعلقة" action={`${pendingLeaves.length} طلب`}>
          {pendingLeaves.length === 0 ? (
            <Empty text="لا توجد طلبات معلقة" />
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
                        {employee?.full_name ?? "موظف"}
                      </span>
                      <span className="block truncate text-[11px] leading-[1.7] text-muted-foreground">
                        {employee?.position || "بدون مسمى"} · {LEAVE_LABELS[row.leave_type] ?? "اجازة"} ·{" "}
                        {numberFormatter.format(daysBetween(row.start_date, row.end_date))} أيام
                      </span>
                    </span>
                    <span className="hidden shrink-0 rounded-md bg-amber-500/10 px-2 py-0.5 text-[11px] text-amber-600 sm:block">
                      معلق
                    </span>
                    {isAdmin ? (
                      <span className="flex shrink-0 items-center gap-1.5">
                        <button
                          type="button"
                          disabled={saving === row.id}
                          onClick={() => void decideLeave(row.id, "approved")}
                          className="flex size-8 items-center justify-center rounded-full bg-emerald-500/10 text-emerald-600 transition-colors hover:bg-emerald-500/20 disabled:opacity-50"
                          aria-label="اعتماد"
                        >
                          <Check className="h-4 w-4" aria-hidden />
                        </button>
                        <button
                          type="button"
                          disabled={saving === row.id}
                          onClick={() => void decideLeave(row.id, "rejected")}
                          className="flex size-8 items-center justify-center rounded-full bg-destructive/10 text-destructive transition-colors hover:bg-destructive/20 disabled:opacity-50"
                          aria-label="رفض"
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
            عرض كل الطلبات
          </Link>
        </Panel>

        <Panel title="صرف الرواتب" action={monthFormatter.format(new Date(`${month}T00:00:00`))}>
          <div className="relative mx-auto h-[150px] w-full max-w-[260px]" dir="ltr">
            <ResponsiveContainer width="100%" height="100%">
              <AreaChart data={weekSeries} margin={{ top: 10, right: 0, left: 0, bottom: 0 }}>
                <defs>
                  <linearGradient id="areaBlue" x1="0" y1="0" x2="0" y2="1">
                    <stop offset="0%" stopColor="#1f6bff" stopOpacity={0.35} />
                    <stop offset="100%" stopColor="#1f6bff" stopOpacity={0} />
                  </linearGradient>
                </defs>
                <Area type="monotone" dataKey="حضور" stroke="#1f6bff" strokeWidth={2} fill="url(#areaBlue)" />
              </AreaChart>
            </ResponsiveContainer>
            <div className="pointer-events-none absolute inset-0 flex flex-col items-center justify-center" dir="rtl">
              <span className="text-xl font-medium text-foreground">{numberFormatter.format(totalNet)} ر.ي</span>
              <span className="mt-0.5 text-[11px] text-muted-foreground">إجمالي المبلغ</span>
            </div>
          </div>
          <div className="mt-2 space-y-1.5">
            <div className="flex items-center justify-between text-[12px]">
              <span className="text-muted-foreground">المصروف فعليا</span>
              <span className="font-medium text-foreground">{numberFormatter.format(approvedNet)} ر.ي</span>
            </div>
            <div className="h-1.5 w-full overflow-hidden rounded-full bg-muted">
              <div className="h-full rounded-full bg-primary" style={{ width: `${disbursedRatio}%` }} />
            </div>
            <p className="text-[11px] text-muted-foreground">{disbursedRatio}% من إجمالي المسير</p>
          </div>
        </Panel>
      </div>

      {!roleLoading && !isAdmin ? (
        <p className="rounded-2xl border border-border/40 bg-card/75 p-4 text-center text-xs leading-[1.8] text-muted-foreground shadow-glass backdrop-blur-sm">
          بعض الاجراءات متاحة لمدير النظام فقط.
        </p>
      ) : null}
    </div>
  );
}

function FeatureCard({ title, value, caption }: { title: string; value: string; caption: string }) {
  return (
    <div className="rounded-2xl bg-gradient-to-b from-[#1f6bff] to-[#0c4bbc] p-3.5 text-primary-foreground shadow-[0_12px_26px_-12px_rgba(12,75,188,0.7),inset_0_1px_0_rgba(255,255,255,0.3)]">
      <div className="flex items-center gap-2">
        <span className="flex size-7 shrink-0 items-center justify-center rounded-full bg-white/15">
          <Users className="h-3.5 w-3.5" aria-hidden />
        </span>
        <p className="truncate text-[12px] font-normal">{title}</p>
      </div>
      <p className="mt-2 text-2xl font-medium leading-tight">{value}</p>
      <p className="mt-0.5 text-[11px] text-primary-foreground/75">{caption}</p>
    </div>
  );
}

function StatCard({
  icon,
  title,
  value,
  caption,
  compact,
}: {
  icon: ReactNode;
  title: string;
  value: string;
  caption: string;
  compact?: boolean;
}) {
  return (
    <div className="rounded-2xl border border-border/40 bg-card/75 p-3.5 shadow-glass backdrop-blur-sm">
      <div className="flex items-center gap-2">
        <span className="flex size-7 shrink-0 items-center justify-center rounded-full bg-muted text-muted-foreground [&_svg]:size-3.5">
          {icon}
        </span>
        <p className="truncate text-[12px] font-normal text-muted-foreground">{title}</p>
      </div>
      <p className={cn("mt-2 truncate font-medium leading-tight text-foreground", compact ? "text-base" : "text-2xl")}>
        {value}
      </p>
      <p className="mt-0.5 truncate text-[11px] text-muted-foreground">{caption}</p>
    </div>
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

function _unusedClock() {
  return <Clock3 />;
}
