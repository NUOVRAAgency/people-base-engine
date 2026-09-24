import { createFileRoute, Link } from "@tanstack/react-router";
import {
  CalendarCheck,
  CheckCircle2,
  Clock3,
  FileSpreadsheet,
  HandCoins,
  Inbox,
  LoaderCircle,
  Plane,
  UserPlus,
  UserRound,
  Wallet,
} from "lucide-react";
import { useCallback, useEffect, useMemo, useState, type ReactNode } from "react";
import { useCurrentUser } from "@/hooks/use-current-user";
import { supabase } from "@/integrations/supabase/client";
import { cn } from "@/lib/utils";

export const Route = createFileRoute("/_authenticated/dashboard")({
  head: () => ({
    meta: [
      { title: "الرئيسية | نظام الموارد البشرية" },
      { name: "description", content: "لوحة تحكم قيادية تعرض الحضور والطلبات المعلقة وحالة الرواتب" },
      { property: "og:title", content: "الرئيسية | نظام الموارد البشرية" },
      { property: "og:description", content: "لوحة تحكم قيادية تعرض الحضور والطلبات المعلقة وحالة الرواتب" },
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
const timeFormatter = new Intl.DateTimeFormat("ar-YE-u-nu-latn", { hour: "2-digit", minute: "2-digit" });

const PAYROLL_STATUS: Record<string, { label: string; tone: string }> = {
  draft: { label: "مسودة", tone: "text-muted-foreground" },
  review: { label: "بانتظار الاعتماد", tone: "text-amber-600" },
  approved: { label: "معتمد", tone: "text-emerald-600" },
};

const LEAVE_LABELS: Record<string, string> = {
  annual: "سنوية",
  sick: "مرضية",
  unpaid: "بدون راتب",
  emergency: "طارئة",
  other: "اخرى",
};

function pad(value: number) {
  return String(value).padStart(2, "0");
}

function todayKey(date: Date) {
  return `${date.getFullYear()}-${pad(date.getMonth() + 1)}-${pad(date.getDate())}`;
}

function monthKey(date: Date) {
  return `${date.getFullYear()}-${pad(date.getMonth() + 1)}-01`;
}

function shortTime(value: string | null) {
  if (!value) return "";
  const parts = value.split(":");
  if (parts.length >= 2) return `${parts[0]}:${parts[1]}`;
  return value;
}

type EmployeeLite = { id: string; full_name: string };
type AttendanceRow = { employee_id: string; status: string; check_in: string | null; date: string };
type LeaveRow = { id: string; employee_id: string; leave_type: string; status: string; start_date: string; created_at: string | null };
type LoanRow = { id: string; employee_id: string; total_amount: number; status: string; created_at: string | null };

function DashboardPage() {
  const { fullName, isAdmin, loading: roleLoading } = useCurrentUser();
  const [loading, setLoading] = useState(true);
  const [employees, setEmployees] = useState<EmployeeLite[]>([]);
  const [attendance, setAttendance] = useState<AttendanceRow[]>([]);
  const [leaves, setLeaves] = useState<LeaveRow[]>([]);
  const [loans, setLoans] = useState<LoanRow[]>([]);
  const [payrollStatus, setPayrollStatus] = useState<string | null>(null);

  const today = useMemo(() => new Date(), []);
  const dayKey = todayKey(today);
  const month = monthKey(today);

  const load = useCallback(async () => {
    setLoading(true);
    const [employeesResult, attendanceResult, leavesResult, loansResult, payrollResult] = await Promise.all([
      supabase.from("employees").select("id,full_name").eq("status", "active").order("full_name"),
      supabase.from("attendance").select("employee_id,status,check_in,date").eq("date", dayKey),
      supabase
        .from("leave_requests")
        .select("id,employee_id,leave_type,status,start_date,created_at")
        .order("created_at", { ascending: false })
        .limit(20),
      supabase
        .from("employee_loans")
        .select("id,employee_id,total_amount,status,created_at")
        .order("created_at", { ascending: false })
        .limit(10),
      supabase.from("payroll").select("status").eq("month", month).limit(1),
    ]);
    setEmployees((employeesResult.data ?? []) as EmployeeLite[]);
    setAttendance((attendanceResult.data ?? []) as AttendanceRow[]);
    setLeaves((leavesResult.data ?? []) as LeaveRow[]);
    setLoans((loansResult.data ?? []) as LoanRow[]);
    setPayrollStatus(((payrollResult.data ?? [])[0]?.status as string | undefined) ?? null);
    setLoading(false);
  }, [dayKey, month]);

  useEffect(() => {
    void load();
  }, [load]);

  const nameById = useMemo(() => {
    const map = new Map<string, string>();
    for (const item of employees) map.set(item.id, item.full_name);
    return map;
  }, [employees]);

  const presentCount = attendance.filter((row) => row.status === "present" || row.status === "late").length;
  const lateCount = attendance.filter((row) => row.status === "late").length;
  const pendingLeaves = leaves.filter((row) => row.status === "pending");
  const payrollInfo = payrollStatus ? PAYROLL_STATUS[payrollStatus] : null;

  const activity = useMemo(() => {
    const items: { id: string; text: string; detail: string; icon: ReactNode }[] = [];
    for (const row of attendance.slice(0, 4)) {
      if (!row.check_in) continue;
      items.push({
        id: `att-${row.employee_id}`,
        text: `${nameById.get(row.employee_id) ?? "موظف"} سجل حضوره`,
        detail: shortTime(row.check_in),
        icon: <CalendarCheck className="h-4 w-4" aria-hidden />,
      });
    }
    for (const row of leaves.slice(0, 4)) {
      items.push({
        id: `leave-${row.id}`,
        text: `${nameById.get(row.employee_id) ?? "موظف"} قدم طلب اجازة ${LEAVE_LABELS[row.leave_type] ?? ""}`.trim(),
        detail: row.created_at ? timeFormatter.format(new Date(row.created_at)) : "",
        icon: <Plane className="h-4 w-4" aria-hidden />,
      });
    }
    for (const row of loans.slice(0, 2)) {
      items.push({
        id: `loan-${row.id}`,
        text: `سلفة جديدة لـ ${nameById.get(row.employee_id) ?? "موظف"}`,
        detail: row.created_at ? timeFormatter.format(new Date(row.created_at)) : "",
        icon: <HandCoins className="h-4 w-4" aria-hidden />,
      });
    }
    return items.slice(0, 4);
  }, [attendance, leaves, loans, nameById]);

  const alerts = useMemo(() => {
    const items: { id: string; title: string; detail: string; to: "/leaves" | "/payroll" | "/employees" }[] = [];
    if (pendingLeaves.length > 0) {
      items.push({
        id: "leaves",
        title: `${pendingLeaves.length} طلب اجازة بانتظار موافقتك`,
        detail: "راجع الطلبات المعلقة واعتمدها",
        to: "/leaves",
      });
    }
    if (!payrollStatus) {
      items.push({
        id: "payroll-missing",
        title: `لم يتم توليد مسير ${monthFormatter.format(new Date(`${month}T00:00:00`))}`,
        detail: "ولد المسير من بيانات الموظفين النشطين",
        to: "/payroll",
      });
    } else if (payrollStatus !== "approved") {
      items.push({
        id: "payroll-review",
        title: "مسير الشهر بانتظار الاعتماد",
        detail: "راجع المبالغ ثم اعتمد الصرف",
        to: "/payroll",
      });
    }
    if (employees.length === 0) {
      items.push({
        id: "employees",
        title: "لا يوجد موظفون نشطون",
        detail: "ابدأ باضافة موظف جديد",
        to: "/employees",
      });
    }
    return items;
  }, [pendingLeaves.length, payrollStatus, month, employees.length]);

  return (
    <div className="mx-auto w-full max-w-6xl space-y-4 pb-6">
      <header className="rounded-2xl border border-border/40 bg-card/75 p-4 shadow-glass backdrop-blur-sm">
        <div className="grid grid-cols-[minmax(0,1fr)_auto] items-center gap-3">
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
        </div>
      </header>

      {loading ? (
        <p className="flex items-center justify-center gap-2 rounded-2xl border border-border/60 bg-card/75 p-10 text-sm text-muted-foreground shadow-glass backdrop-blur-sm">
          <LoaderCircle className="h-4 w-4 animate-spin" aria-hidden />
          جاري تجهيز اللوحة
        </p>
      ) : (
        <>
          <section className="grid grid-cols-2 gap-2.5 lg:grid-cols-4">
            <Kpi
              icon={<CheckCircle2 className="h-4 w-4" aria-hidden />}
              title="الحضور اليوم"
              value={`${presentCount} / ${employees.length}`}
              tone="text-emerald-600"
            />
            <Kpi
              icon={<Clock3 className="h-4 w-4" aria-hidden />}
              title="المتأخرون"
              value={String(lateCount)}
              tone="text-amber-600"
            />
            <Kpi
              icon={<Inbox className="h-4 w-4" aria-hidden />}
              title="طلبات تنتظر موافقتك"
              value={String(pendingLeaves.length)}
              tone="text-primary"
            />
            <Kpi
              icon={<Wallet className="h-4 w-4" aria-hidden />}
              title={monthFormatter.format(new Date(`${month}T00:00:00`))}
              value={payrollInfo ? payrollInfo.label : "لم يولد بعد"}
              tone={payrollInfo ? payrollInfo.tone : "text-muted-foreground"}
            />
          </section>

          <section className="rounded-2xl border border-border/40 bg-card/75 p-3 shadow-glass backdrop-blur-sm">
            <h3 className="mb-2.5 px-1 text-sm font-medium text-foreground">إجراءات سريعة</h3>
            <div className="flex gap-2 overflow-x-auto pb-1 scrollbar-hide md:grid md:grid-cols-4 md:overflow-visible md:pb-0">
              <QuickAction to="/employees" icon={<UserPlus className="h-4 w-4" aria-hidden />} label="إضافة موظف" />
              <QuickAction to="/attendance" icon={<CalendarCheck className="h-4 w-4" aria-hidden />} label="تسجيل حضور" />
              {isAdmin ? (
                <>
                  <QuickAction to="/payroll" icon={<FileSpreadsheet className="h-4 w-4" aria-hidden />} label="توليد المسير" />
                  <QuickAction to="/payroll" icon={<HandCoins className="h-4 w-4" aria-hidden />} label="إضافة سلفة" />
                </>
              ) : null}
            </div>
          </section>

          <div className="grid gap-3 lg:grid-cols-2">
            <section className="rounded-2xl border border-border/40 bg-card/75 p-4 shadow-glass backdrop-blur-sm">
              <h3 className="mb-3 text-sm font-medium text-foreground">تنبيهات تحتاج إجراء</h3>
              {alerts.length === 0 ? (
                <div className="rounded-xl border border-dashed border-border/60 bg-background/40 p-6 text-center">
                  <span className="mx-auto flex size-11 items-center justify-center rounded-full bg-muted text-muted-foreground">
                    <CheckCircle2 className="h-5 w-5" aria-hidden />
                  </span>
                  <p className="mt-2.5 text-sm font-medium text-foreground">لا توجد مهام معلقة</p>
                  <p className="mt-1 text-xs leading-[1.8] text-muted-foreground">كل الامور تحت السيطرة</p>
                </div>
              ) : (
                <ul className="space-y-2">
                  {alerts.map((item) => (
                    <li key={item.id}>
                      <Link
                        to={item.to}
                        className="flex items-center gap-3 rounded-xl border border-border/40 bg-background/40 p-3 transition-colors hover:bg-muted/60"
                      >
                        <span className="flex size-8 shrink-0 items-center justify-center rounded-full bg-amber-500/10 text-amber-600">
                          <Inbox className="h-4 w-4" aria-hidden />
                        </span>
                        <span className="min-w-0 flex-1">
                          <span className="block truncate text-[13px] font-medium text-foreground">{item.title}</span>
                          <span className="block truncate text-[11px] leading-[1.7] text-muted-foreground">{item.detail}</span>
                        </span>
                      </Link>
                    </li>
                  ))}
                </ul>
              )}
            </section>

            <section className="rounded-2xl border border-border/40 bg-card/75 p-4 shadow-glass backdrop-blur-sm">
              <h3 className="mb-3 text-sm font-medium text-foreground">أحدث الأنشطة</h3>
              {activity.length === 0 ? (
                <div className="rounded-xl border border-dashed border-border/60 bg-background/40 p-6 text-center">
                  <p className="text-sm font-medium text-foreground">لا توجد حركات بعد</p>
                  <p className="mt-1 text-xs leading-[1.8] text-muted-foreground">ستظهر هنا اول حركة في النظام</p>
                </div>
              ) : (
                <ul className="space-y-2">
                  {activity.map((item) => (
                    <li key={item.id} className="flex items-center gap-3 rounded-xl border border-border/40 bg-background/40 p-3">
                      <span className="flex size-8 shrink-0 items-center justify-center rounded-full bg-muted text-muted-foreground">
                        {item.icon}
                      </span>
                      <span className="min-w-0 flex-1 truncate text-[13px] text-foreground">{item.text}</span>
                      <span className="shrink-0 text-[11px] text-muted-foreground">{item.detail}</span>
                    </li>
                  ))}
                </ul>
              )}
            </section>
          </div>

          {!roleLoading && !isAdmin ? (
            <p className="rounded-2xl border border-border/40 bg-card/75 p-4 text-center text-xs leading-[1.8] text-muted-foreground shadow-glass backdrop-blur-sm">
              بعض الاجراءات متاحة لمدير النظام فقط.
            </p>
          ) : null}
        </>
      )}
    </div>
  );
}

function Kpi({ icon, title, value, tone }: { icon: ReactNode; title: string; value: string; tone: string }) {
  return (
    <div className="rounded-2xl border border-border/40 bg-card/75 px-3 py-2.5 shadow-glass backdrop-blur-sm">
      <div className="flex items-center gap-2">
        <span className={cn("flex size-7 shrink-0 items-center justify-center rounded-full bg-muted [&_svg]:size-3.5", tone)}>
          {icon}
        </span>
        <p className="truncate text-[11px] font-normal leading-tight text-muted-foreground">{title}</p>
      </div>
      <p className={cn("mt-1.5 truncate text-sm font-medium leading-tight", tone)}>{value}</p>
    </div>
  );
}

function QuickAction({
  to,
  icon,
  label,
}: {
  to: "/employees" | "/attendance" | "/payroll";
  icon: ReactNode;
  label: string;
}) {
  return (
    <Link
      to={to}
      className="flex min-w-[116px] shrink-0 flex-col items-center justify-center gap-1.5 rounded-xl border border-border/40 bg-background/50 px-3 py-3 text-center transition-colors hover:bg-muted/60 md:min-w-0"
    >
      <span className="flex size-9 items-center justify-center rounded-full bg-primary/10 text-primary">{icon}</span>
      <span className="text-[12px] font-medium leading-tight text-foreground">{label}</span>
    </Link>
  );
}
