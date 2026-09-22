import { createFileRoute } from "@tanstack/react-router";
import { useEffect, useMemo, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import {
  Bell,
  CalendarCheck,
  ChartNoAxesCombined,
  ClipboardList,
  Home,
  Users,
  UserCheck,
  UserRoundCog,
  UserX,
  Wallet,
} from "lucide-react";
import { Button } from "@/components/ui/button";

export const Route = createFileRoute("/_authenticated/dashboard")({
  head: () => ({
    meta: [
      { title: "لوحة التحكم | HR System" },
      { name: "description", content: "لوحة تحكم نظام إدارة الموارد البشرية" },
      { property: "og:title", content: "لوحة التحكم | HR System" },
      { property: "og:description", content: "لوحة تحكم نظام إدارة الموارد البشرية" },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary_large_image" },
    ],
  }),
  component: Dashboard,
});

type AppRole = "admin" | "operator" | "viewer";

const ROLE_LABELS: Record<AppRole, string> = {
  admin: "مدير النظام",
  operator: "مشغّل",
  viewer: "مشاهد",
};

const BASE_TABS = [
  { label: "الرئيسية", Icon: Home, active: true },
  { label: "الموظفون", Icon: Users },
  { label: "الحضور", Icon: CalendarCheck },
  { label: "التقارير", Icon: ClipboardList },
];

const BASE_STATS = [
  { label: "إجمالي الموظفين", value: "24", Icon: Users, tone: "primary" },
  { label: "الحاضرون اليوم", value: "21", Icon: UserCheck, tone: "success" },
  { label: "المتأخرون/الغائبون اليوم", value: "3", Icon: UserX, tone: "warning" },
] as const;

function Dashboard() {
  const [userName, setUserName] = useState("مدير النظام");
  const [role, setRole] = useState<AppRole | null>(null);
  const [today, setToday] = useState("");

  useEffect(() => {
    supabase.auth.getUser().then(async ({ data }) => {
      if (!data.user) return;
      const email = data.user?.email ?? "";
      const metadataName = data.user.user_metadata?.["full_name"];
      const name = typeof metadataName === "string" && metadataName.trim()
        ? metadataName.trim()
        : email.split("@")[0] || "مستخدم النظام";
      setUserName(name);

      const { data: roleRows } = await supabase
        .from("user_roles")
        .select("role")
        .eq("user_id", data.user.id);
      const roles = roleRows?.map((row) => row.role) ?? [];
      setRole(roles.includes("admin") ? "admin" : roles.includes("operator") ? "operator" : "viewer");
    });
    setToday(
      new Intl.DateTimeFormat("ar", {
        weekday: "long",
        day: "numeric",
        month: "long",
        year: "numeric",
      }).format(new Date())
    );
  }, []);

  const navigation = useMemo(
    () =>
      role === "admin"
        ? [...BASE_TABS.slice(0, 3), { label: "الرواتب", Icon: Wallet }, ...BASE_TABS.slice(3)]
        : BASE_TABS,
    [role],
  );

  const stats = useMemo(
    () =>
      role === "admin"
        ? [
            ...BASE_STATS.slice(0, 2),
            { label: "إجمالي رواتب الشهر", value: "86,400", Icon: Wallet, tone: "payroll" as const },
            BASE_STATS[2],
          ]
        : BASE_STATS,
    [role],
  );

  const toneClass = {
    primary: "bg-primary/10 text-primary",
    success: "bg-success/12 text-success",
    warning: "bg-warning/15 text-warning-foreground",
    payroll: "bg-ink/8 text-ink",
  } as const;

  return (
    <div className="min-h-screen bg-background">
      <aside className="fixed inset-y-0 left-0 z-40 hidden w-70 border-r border-primary-foreground/15 bg-header-blue text-primary-foreground shadow-sidebar backdrop-blur-2xl md:flex md:flex-col">
        <div className="flex h-24 items-center gap-3 border-b border-primary-foreground/15 px-6" dir="rtl">
          <span className="grid h-11 w-11 shrink-0 place-items-center rounded-lg border border-primary-foreground/20 bg-primary-foreground/15">
            <UserRoundCog className="h-5 w-5" />
          </span>
          <div className="min-w-0">
            <p className="truncate text-sm font-bold">الموارد البشرية</p>
            <p className="mt-0.5 text-xs text-primary-foreground/65">نظام إدارة موحّد</p>
          </div>
        </div>

        <nav aria-label="التنقل الرئيسي" className="flex-1 space-y-2 px-4 py-7" dir="rtl">
          {navigation.map(({ label, Icon, active }) => (
            <Button
              key={label}
              type="button"
              variant="ghost"
              aria-current={active ? "page" : undefined}
              className={`h-12 w-full justify-start rounded-lg px-4 text-primary-foreground hover:bg-primary-foreground/12 hover:text-primary-foreground ${
                active ? "border border-primary-foreground/20 bg-primary-foreground/18 shadow-nav" : "text-primary-foreground/75"
              }`}
            >
              <Icon className="h-5 w-5" />
              <span>{label}</span>
            </Button>
          ))}
        </nav>

        <div className="border-t border-primary-foreground/15 p-4" dir="rtl">
          <div className="grid grid-cols-[auto_minmax(0,1fr)] items-center gap-3 rounded-lg bg-primary-foreground/10 p-3">
            <span className="grid h-9 w-9 shrink-0 place-items-center rounded-lg bg-primary-foreground/15 text-xs font-bold">
              {userName.slice(0, 1)}
            </span>
            <div className="min-w-0">
              <p className="truncate text-xs font-semibold">{userName}</p>
              <p className="mt-0.5 text-[11px] text-primary-foreground/65">
                {role ? ROLE_LABELS[role] : "جارٍ التحميل"}
              </p>
            </div>
          </div>
        </div>
      </aside>

      <main className="min-h-screen pb-28 md:ml-70 md:pb-0" dir="rtl">
        <div className="mx-auto max-w-7xl px-5 py-8 sm:px-8 sm:py-12 lg:px-12">
          <header className="grid grid-cols-[minmax(0,1fr)_auto] items-start gap-4">
            <div className="min-w-0">
              <p className="mb-2 text-sm font-semibold text-primary">لوحة التحكم</p>
              <h1 className="truncate text-2xl font-bold text-foreground sm:text-3xl">مرحبًا، {userName}</h1>
              <p className="mt-2 text-sm text-muted-foreground sm:text-base">{today}</p>
            </div>
            <span className="mt-1 hidden shrink-0 rounded-lg border border-border bg-card px-3 py-2 text-xs font-semibold text-muted-foreground shadow-sm sm:inline-flex">
              {role ? ROLE_LABELS[role] : "جارٍ التحميل"}
            </span>
          </header>

          <section aria-label="الإحصائيات" className="mt-9 grid grid-cols-1 gap-4 sm:grid-cols-2 xl:grid-cols-4">
            {role === null
              ? Array.from({ length: 3 }).map((_, index) => (
                  <div key={index} className="h-40 animate-pulse rounded-lg border border-border bg-muted/45" />
                ))
              : stats.map(({ label, value, Icon, tone }) => (
                  <article
                    key={label}
                    className="min-h-40 rounded-lg border border-glass-border bg-glass p-5 shadow-glass backdrop-blur-xl transition duration-200 hover:-translate-y-0.5 hover:shadow-card"
                  >
                    <div className={`grid h-10 w-10 place-items-center rounded-lg ${toneClass[tone]}`}>
                      <Icon className="h-5 w-5" aria-hidden="true" />
                    </div>
                    <p className="mt-5 text-3xl font-bold text-foreground">{value}</p>
                    <p className="mt-1 text-sm text-muted-foreground">{label}</p>
                  </article>
                ))}
          </section>

          <section className="mt-6 rounded-lg border border-glass-border bg-glass p-5 shadow-glass backdrop-blur-xl sm:p-6">
            <div className="flex items-center gap-3">
              <span className="grid h-10 w-10 shrink-0 place-items-center rounded-lg bg-primary/10 text-primary">
                <Bell className="h-5 w-5" aria-hidden="true" />
              </span>
              <div>
                <h2 className="font-bold text-foreground">تنبيهات ذكية</h2>
                <p className="mt-0.5 text-xs text-muted-foreground">آخر التحديثات المهمة</p>
              </div>
            </div>
            <div className="mt-5 grid min-h-40 place-items-center rounded-lg border border-dashed border-border bg-background/45 px-4 text-center">
              <div>
                <ChartNoAxesCombined className="mx-auto h-6 w-6 text-muted-foreground/55" aria-hidden="true" />
                <p className="mt-2 text-sm text-muted-foreground">لا توجد تنبيهات حاليًا</p>
              </div>
            </div>
          </section>
        </div>
      </main>

      <nav
        aria-label="التنقل الرئيسي"
        className="fixed inset-x-3 bottom-3 z-50 grid min-h-17 border border-primary-foreground/15 bg-header-blue p-1.5 text-primary-foreground shadow-mobile-nav backdrop-blur-2xl md:hidden"
        style={{ gridTemplateColumns: `repeat(${navigation.length}, minmax(0, 1fr))` }}
        dir="rtl"
      >
        {navigation.map(({ label, Icon, active }) => (
          <Button
            key={label}
            type="button"
            variant="ghost"
            aria-current={active ? "page" : undefined}
            className={`h-14 min-w-0 flex-col gap-1 rounded-md px-1 text-[10px] text-primary-foreground hover:bg-primary-foreground/12 hover:text-primary-foreground ${
              active ? "bg-primary-foreground/18" : "text-primary-foreground/70"
            }`}
          >
            <Icon className="h-4.5 w-4.5 shrink-0" />
            <span className="max-w-full truncate">{label}</span>
          </Button>
        ))}
      </nav>
    </div>
  );
}
