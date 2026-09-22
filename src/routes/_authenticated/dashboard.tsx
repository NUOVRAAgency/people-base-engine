import { createFileRoute, useNavigate } from "@tanstack/react-router";
import {
  Bell,
  CalendarDays,
  ChartNoAxesCombined,
  ChevronLeft,
  CircleDollarSign,
  Clock3,
  FileChartColumn,
  House,
  LogOut,
  Sparkles,
  UserRoundCheck,
  UsersRound,
} from "lucide-react";
import { useEffect, useMemo, useState, type ComponentType } from "react";
import { Button } from "@/components/ui/button";
import { supabase } from "@/integrations/supabase/client";

export const Route = createFileRoute("/_authenticated/dashboard")({
  ssr: false,
  head: () => ({
    meta: [
      { title: "الرئيسية | نظام الموارد البشرية" },
      { name: "description", content: "الرئيسية في نظام إدارة الموارد البشرية" },
      { property: "og:title", content: "الرئيسية | نظام الموارد البشرية" },
      { property: "og:description", content: "الرئيسية في نظام إدارة الموارد البشرية" },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary_large_image" },
    ],
  }),
  component: DashboardPage,
});

type Role = "admin" | "operator" | "viewer";

type DashboardStats = {
  employees: number;
  present: number;
  delayedOrAbsent: number;
  payroll: number;
};

type NavItem = {
  label: string;
  icon: ComponentType<{ className?: string; "aria-hidden"?: boolean }>;
  adminOnly?: boolean;
};

const NAV_ITEMS: NavItem[] = [
  { label: "الرئيسية", icon: House },
  { label: "الموظفون", icon: UsersRound },
  { label: "الحضور", icon: UserRoundCheck },
  { label: "الرواتب", icon: CircleDollarSign, adminOnly: true },
  { label: "التقارير", icon: FileChartColumn },
];

const ROLE_LABELS: Record<Role, string> = {
  admin: "مدير النظام",
  operator: "مشغّل",
  viewer: "مشاهد",
};

const WEEK_ACTIVITY = [54, 72, 64, 88, 76, 92, 81];
const WEEK_DAYS = ["الأحد", "الاثنين", "الثلاثاء", "الأربعاء", "الخميس", "الجمعة", "السبت"];

function DashboardPage() {
  const navigate = useNavigate();
  const [role, setRole] = useState<Role>("viewer");
  const [name, setName] = useState("مستخدم النظام");
  const [email, setEmail] = useState("");
  const [loading, setLoading] = useState(true);
  const [stats, setStats] = useState<DashboardStats>({ employees: 0, present: 0, delayedOrAbsent: 0, payroll: 0 });

  const today = useMemo(
    () => new Intl.DateTimeFormat("ar-YE", { weekday: "long", day: "numeric", month: "long", year: "numeric" }).format(new Date()),
    [],
  );

  useEffect(() => {
    let mounted = true;

    async function loadDashboard() {
      const { data: userResult } = await supabase.auth.getUser();
      const user = userResult.user;
      if (!user || !mounted) return;

      const { data: roles } = await supabase.from("user_roles").select("role").eq("user_id", user.id);
      const availableRoles = (roles ?? []).map((item) => item.role);
      const currentRole: Role = availableRoles.includes("admin")
        ? "admin"
        : availableRoles.includes("operator")
          ? "operator"
          : "viewer";

      const localDate = new Date();
      const date = `${localDate.getFullYear()}-${String(localDate.getMonth() + 1).padStart(2, "0")}-${String(localDate.getDate()).padStart(2, "0")}`;
      const monthStart = `${localDate.getFullYear()}-${String(localDate.getMonth() + 1).padStart(2, "0")}-01`;

      const [employeesResult, presentResult, exceptionsResult, payrollResult] = await Promise.all([
        supabase.from("employees").select("id", { count: "exact", head: true }),
        supabase.from("attendance").select("id", { count: "exact", head: true }).eq("date", date).eq("status", "present"),
        supabase.from("attendance").select("id", { count: "exact", head: true }).eq("date", date).in("status", ["late", "absent"]),
        currentRole === "admin"
          ? supabase.from("payroll").select("net_salary").gte("month", monthStart)
          : Promise.resolve({ data: [] as { net_salary: number }[] }),
      ]);

      if (!mounted) return;
      setRole(currentRole);
      setName(String(user.user_metadata?.["full_name"] ?? user.email?.split("@")[0] ?? "مستخدم النظام"));
      setEmail(user.email ?? "");
      setStats({
        employees: employeesResult.count ?? 0,
        present: presentResult.count ?? 0,
        delayedOrAbsent: exceptionsResult.count ?? 0,
        payroll: (payrollResult.data ?? []).reduce((sum, row) => sum + Number(row.net_salary), 0),
      });
      setLoading(false);
    }

    void loadDashboard();
    return () => {
      mounted = false;
    };
  }, []);

  async function signOut() {
    await supabase.auth.signOut();
    navigate({ to: "/auth", replace: true });
  }

  const visibleNav = NAV_ITEMS.filter((item) => !item.adminOnly || role === "admin");
  const cards = [
    { label: "إجمالي الموظفين", value: stats.employees.toLocaleString("ar"), icon: UsersRound, tone: "bg-primary/10 text-primary" },
    { label: "الحاضرون اليوم", value: stats.present.toLocaleString("ar"), icon: UserRoundCheck, tone: "bg-success/10 text-success" },
    ...(role === "admin"
      ? [{ label: "إجمالي رواتب الشهر", value: `${stats.payroll.toLocaleString("ar")} ر.س`, icon: CircleDollarSign, tone: "bg-warning/15 text-warning-foreground" }]
      : []),
    { label: "المتأخرون والغائبون", value: stats.delayedOrAbsent.toLocaleString("ar"), icon: Clock3, tone: "bg-destructive/10 text-destructive" },
  ];

  return (
    <div className="min-h-dvh bg-secondary/40 text-foreground" dir="rtl">
      <aside className="fixed inset-y-0 right-0 z-30 hidden w-64 flex-col border-l border-primary/15 bg-background/90 px-4 py-5 shadow-sidebar backdrop-blur-xl md:flex">
        <div className="flex items-center gap-3 px-2 pb-7">
          <div className="grid size-11 shrink-0 place-items-center rounded-lg bg-primary text-primary-foreground shadow-nav">
            <ChartNoAxesCombined className="size-6" aria-hidden="true" />
          </div>
          <div className="min-w-0">
            <p className="truncate text-base font-bold">نظام الموارد البشرية</p>
            <p className="text-xs text-muted-foreground">إدارة فريق العمل</p>
          </div>
        </div>

        <p className="px-3 pb-2 text-xs font-semibold text-muted-foreground">القائمة الرئيسية</p>
        <nav className="space-y-1" aria-label="أقسام النظام">
          {visibleNav.map((item, index) => {
            const Icon = item.icon;
            return (
              <Button
                key={item.label}
                type="button"
                variant={index === 0 ? "default" : "ghost"}
                className="h-11 w-full justify-start gap-3 rounded-lg px-3 text-sm"
              >
                <Icon className="size-5 shrink-0" aria-hidden="true" />
                {item.label}
                {index === 0 ? <ChevronLeft className="mr-auto size-4" aria-hidden="true" /> : null}
              </Button>
            );
          })}
        </nav>

        <div className="mt-auto border-t border-border pt-4">
          <div className="mb-3 flex min-w-0 items-center gap-3 px-2">
            <div className="grid size-10 shrink-0 place-items-center rounded-full bg-primary/10 font-bold text-primary">
              {name.slice(0, 1)}
            </div>
            <div className="min-w-0">
              <p className="truncate text-sm font-semibold">{name}</p>
              <p className="truncate text-xs text-muted-foreground">{email}</p>
            </div>
          </div>
          <Button type="button" variant="ghost" onClick={signOut} className="w-full justify-start gap-3 text-muted-foreground hover:text-destructive">
            <LogOut className="size-4" aria-hidden="true" />
            تسجيل الخروج
          </Button>
        </div>
      </aside>

      <div className="md:pr-64">
        <header className="sticky top-0 z-20 border-b border-border/80 bg-background/90 px-4 py-3 backdrop-blur-xl md:px-8">
          <div className="grid grid-cols-[minmax(0,1fr)_auto] items-center gap-3">
            <div className="flex min-w-0 items-center gap-3">
              <div className="grid size-9 shrink-0 place-items-center rounded-lg bg-primary text-primary-foreground md:hidden">
                <ChartNoAxesCombined className="size-5" aria-hidden="true" />
              </div>
              <div className="min-w-0">
                <p className="truncate text-sm font-bold md:text-base">الرئيسية</p>
                <p className="truncate text-xs text-muted-foreground">{ROLE_LABELS[role]}</p>
              </div>
            </div>
            <Button type="button" variant="ghost" size="icon" className="shrink-0" aria-label="الإشعارات">
              <Bell className="size-5" aria-hidden="true" />
            </Button>
          </div>

          <nav className="mt-3 flex gap-2 overflow-x-auto pb-1 md:hidden" aria-label="أقسام النظام">
            {visibleNav.map((item, index) => {
              const Icon = item.icon;
              return (
                <Button key={item.label} type="button" variant={index === 0 ? "default" : "outline"} size="sm" className="shrink-0 gap-2 rounded-lg">
                  <Icon className="size-4" aria-hidden="true" />
                  {item.label}
                </Button>
              );
            })}
          </nav>
        </header>

        <main className="mx-auto max-w-[1500px] px-4 py-6 md:px-8 md:py-8">
          <section className="mb-6 grid grid-cols-[minmax(0,1fr)_auto] items-start gap-4">
            <div className="min-w-0">
              <h1 className="truncate text-2xl font-bold md:text-3xl">مرحباً، {name}</h1>
              <p className="mt-1 text-sm text-muted-foreground md:text-base">هذه نظرة سريعة على فريقك اليوم.</p>
            </div>
            <div className="hidden shrink-0 items-center gap-2 rounded-lg border border-border bg-background px-3 py-2 text-sm text-muted-foreground shadow-sm sm:flex">
              <CalendarDays className="size-4 text-primary" aria-hidden="true" />
              {today}
            </div>
          </section>

          <section className={`grid gap-3 ${role === "admin" ? "sm:grid-cols-2 xl:grid-cols-4" : "sm:grid-cols-3"}`} aria-label="إحصاءات اليوم">
            {cards.map((card) => {
              const Icon = card.icon;
              return (
                <article key={card.label} className="rounded-lg border border-border bg-card p-4 shadow-sm md:p-5">
                  <div className={`grid size-10 place-items-center rounded-lg ${card.tone}`}>
                    <Icon className="size-5" aria-hidden="true" />
                  </div>
                  <p className={`mt-5 text-2xl font-bold ${loading ? "animate-pulse text-muted-foreground/30" : ""}`}>{loading ? "––" : card.value}</p>
                  <p className="mt-1 text-sm text-muted-foreground">{card.label}</p>
                </article>
              );
            })}
          </section>

          <section className="mt-4 grid gap-4 xl:grid-cols-[1.45fr_1fr]">
            <article className="rounded-lg border border-border bg-card p-4 shadow-sm md:p-6">
              <div className="mb-7 flex items-center justify-between gap-3">
                <div>
                  <h2 className="font-bold">نشاط الحضور الأسبوعي</h2>
                  <p className="mt-1 text-xs text-muted-foreground">ملخص آخر سبعة أيام</p>
                </div>
                <span className="rounded-md bg-success/10 px-2 py-1 text-xs font-semibold text-success">نشط</span>
              </div>
              <div className="flex h-48 items-end justify-between gap-2 border-b border-border px-1 md:h-56 md:gap-4">
                {WEEK_ACTIVITY.map((height, index) => (
                  <div key={WEEK_DAYS[index]} className="flex h-full min-w-0 flex-1 flex-col justify-end gap-2">
                    <div className="relative flex flex-1 items-end rounded-t-md bg-secondary">
                      <div className="w-full rounded-t-md bg-primary/80 transition-all" style={{ height: `${height}%` }} />
                    </div>
                    <span className="truncate pb-2 text-center text-[10px] text-muted-foreground md:text-xs">{WEEK_DAYS[index]}</span>
                  </div>
                ))}
              </div>
            </article>

            <article className="rounded-lg border border-border bg-card p-4 shadow-sm md:p-6">
              <h2 className="font-bold">حالة الموظفين</h2>
              <p className="mt-1 text-xs text-muted-foreground">توزيع حالة الفريق اليوم</p>
              <div className="mt-8 grid place-items-center">
                <div className="grid aspect-square w-40 place-items-center rounded-full border-[18px] border-primary/15 outline outline-[18px] outline-primary/80 outline-offset-[-36px]">
                  <div className="text-center">
                    <p className="text-3xl font-bold">{loading ? "––" : stats.employees.toLocaleString("ar")}</p>
                    <p className="text-xs text-muted-foreground">موظف</p>
                  </div>
                </div>
              </div>
              <div className="mt-8 space-y-3">
                <StatusRow label="حاضرون" value={stats.present} total={Math.max(stats.employees, 1)} className="bg-primary" />
                <StatusRow label="متأخرون أو غائبون" value={stats.delayedOrAbsent} total={Math.max(stats.employees, 1)} className="bg-destructive" />
              </div>
            </article>
          </section>

          <section className="mt-4 grid gap-4 xl:grid-cols-[1.45fr_1fr]">
            <article className="rounded-lg border border-border bg-card p-4 shadow-sm md:p-6">
              <div className="flex items-center gap-3">
                <div className="grid size-10 shrink-0 place-items-center rounded-lg bg-primary/10 text-primary">
                  <Clock3 className="size-5" aria-hidden="true" />
                </div>
                <div>
                  <h2 className="font-bold">آخر النشاطات</h2>
                  <p className="text-xs text-muted-foreground">تحديثات الحضور تظهر هنا</p>
                </div>
              </div>
              <div className="mt-5 flex min-h-24 items-center justify-center rounded-lg border border-dashed border-border bg-secondary/50 px-4 text-center text-sm text-muted-foreground">
                لا توجد نشاطات جديدة اليوم
              </div>
            </article>

            <article className="rounded-lg border border-primary/20 bg-primary/5 p-4 shadow-sm md:p-6">
              <div className="flex items-center gap-3">
                <div className="grid size-10 shrink-0 place-items-center rounded-lg bg-primary text-primary-foreground">
                  <Sparkles className="size-5" aria-hidden="true" />
                </div>
                <div>
                  <h2 className="font-bold">تنبيهات ذكية</h2>
                  <p className="text-xs text-muted-foreground">ملاحظات تساعدك على المتابعة</p>
                </div>
              </div>
              <div className="mt-5 flex min-h-24 items-center justify-center rounded-lg border border-dashed border-primary/20 bg-background/70 px-4 text-center text-sm text-muted-foreground">
                لا توجد تنبيهات حالياً
              </div>
            </article>
          </section>
        </main>
      </div>
    </div>
  );
}

function StatusRow({ label, value, total, className }: { label: string; value: number; total: number; className: string }) {
  const width = Math.min(100, Math.max(0, (value / total) * 100));
  return (
    <div>
      <div className="mb-1.5 flex items-center justify-between gap-3 text-xs">
        <span className="text-muted-foreground">{label}</span>
        <span className="font-semibold">{value.toLocaleString("ar")}</span>
      </div>
      <div className="h-2 overflow-hidden rounded-full bg-secondary">
        <div className={`h-full rounded-full ${className}`} style={{ width: `${width}%` }} />
      </div>
    </div>
  );
}