import { createFileRoute } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { Users, TrendingUp, Wallet, UserX, Sparkles } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { AppShell } from "@/components/app-shell";
import { useCurrentUser } from "@/hooks/use-current-user";
import { cn } from "@/lib/utils";

export const Route = createFileRoute("/_authenticated/dashboard")({
  ssr: false,
  head: () => ({
    meta: [
      { title: "الرئيسية | نظام الموارد البشرية" },
      { name: "description", content: "لوحة متابعة الموظفين والحضور والرواتب" },
      { property: "og:title", content: "الرئيسية | نظام الموارد البشرية" },
      { property: "og:description", content: "لوحة متابعة الموظفين والحضور والرواتب" },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary_large_image" },
    ],
  }),
  component: DashboardPage,
});

const WEEK_DAYS = ["الأحد", "الاثنين", "الثلاثاء", "الأربعاء", "الخميس", "الجمعة", "السبت"];

type Stats = {
  employees: number;
  present: number;
  absent: number;
  payroll: number;
  week: { day: string; present: number; total: number }[];
};

const EMPTY: Stats = { employees: 0, present: 0, absent: 0, payroll: 0, week: [] };

function iso(d: Date) {
  return d.toISOString().slice(0, 10);
}

function DashboardPage() {
  const { fullName, isAdmin } = useCurrentUser();
  const [stats, setStats] = useState<Stats>(EMPTY);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    let mounted = true;
    (async () => {
      const today = iso(new Date());
      const weekStart = new Date();
      weekStart.setDate(weekStart.getDate() - 6);

      const [employeesRes, todayRes, weekRes] = await Promise.all([
        supabase.from("employees").select("id", { count: "exact", head: true }),
        supabase.from("attendance").select("status").eq("date", today),
        supabase.from("attendance").select("date,status").gte("date", iso(weekStart)),
      ]);

      let payroll = 0;
      if (isAdmin) {
        const month = `${new Date().toISOString().slice(0, 7)}-01`;
        const { data } = await supabase.from("payroll").select("net_salary").eq("month", month);
        payroll = (data ?? []).reduce((sum, r) => sum + Number(r.net_salary ?? 0), 0);
      }

      if (!mounted) return;

      const todayRows = todayRes.data ?? [];
      const weekRows = weekRes.data ?? [];
      const week = Array.from({ length: 7 }, (_, i) => {
        const d = new Date();
        d.setDate(d.getDate() - (6 - i));
        const key = iso(d);
        const rows = weekRows.filter((r) => r.date === key);
        return {
          day: WEEK_DAYS[d.getDay()] ?? "",
          present: rows.filter((r) => r.status === "present").length,
          total: rows.length,
        };
      });

      setStats({
        employees: employeesRes.count ?? 0,
        present: todayRows.filter((r) => r.status === "present").length,
        absent: todayRows.filter((r) => r.status === "absent" || r.status === "late").length,
        payroll,
        week,
      });
      setLoading(false);
    })();
    return () => {
      mounted = false;
    };
  }, [isAdmin]);

  const rate =
    stats.employees > 0 ? Math.round((stats.present / stats.employees) * 100) : 0;

  const cards = [
    { label: "إجمالي الموظفين", value: String(stats.employees), icon: Users },
    { label: "معدل الحضور", value: `${rate}%`, icon: TrendingUp },
    ...(isAdmin
      ? [
          {
            label: "إجمالي الرواتب",
            value: `${stats.payroll.toLocaleString("ar-EG")} ر.س`,
            icon: Wallet,
          },
        ]
      : []),
    { label: "الغائبون/المتأخرون", value: String(stats.absent), icon: UserX },
  ];

  const maxWeek = Math.max(1, ...stats.week.map((w) => w.present));

  return (
    <AppShell title="الرئيسية">
      <div className="space-y-6">
        <div>
          <h2 className="text-2xl font-bold text-foreground">الرئيسية</h2>
          <p className="mt-1 text-sm text-muted-foreground">
            مرحباً بك، {fullName || "..."}. إليك آخر المستجدات اليوم.
          </p>
        </div>

        <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
          {cards.map((c) => {
            const Icon = c.icon;
            return (
              <div
                key={c.label}
                className="rounded-2xl border border-border bg-card p-5 shadow-card"
              >
                <div className="grid size-11 place-items-center rounded-xl bg-primary/10 text-primary">
                  <Icon className="size-5" />
                </div>
                <p
                  className={cn(
                    "mt-4 text-2xl font-bold text-foreground",
                    loading && "animate-pulse text-muted-foreground",
                  )}
                >
                  {c.value}
                </p>
                <p className="mt-1 text-sm text-muted-foreground">{c.label}</p>
              </div>
            );
          })}
        </div>

        <div className="grid gap-4 lg:grid-cols-3">
          <section className="rounded-2xl border border-border bg-card p-6 shadow-card lg:col-span-2">
            <div className="flex items-center justify-between gap-4">
              <div className="min-w-0">
                <h3 className="text-base font-bold text-foreground">حضور آخر سبعة أيام</h3>
                <p className="mt-1 text-xs text-muted-foreground">
                  عدد الموظفين الحاضرين في كل يوم
                </p>
              </div>
            </div>
            <div className="mt-6 flex h-44 items-end justify-between gap-2">
              {stats.week.map((w, i) => (
                <div key={i} className="flex min-w-0 flex-1 flex-col items-center gap-2">
                  <span className="text-[11px] font-semibold text-foreground">{w.present}</span>
                  <div
                    className="w-full rounded-t-lg bg-primary/80"
                    style={{ height: `${Math.max(6, (w.present / maxWeek) * 120)}px` }}
                  />
                  <span className="truncate text-[10px] text-muted-foreground">{w.day}</span>
                </div>
              ))}
            </div>
          </section>

          <section className="rounded-2xl border border-border bg-card p-6 shadow-card">
            <h3 className="text-base font-bold text-foreground">ملخص اليوم</h3>
            <div className="mt-5 space-y-4">
              <SummaryRow label="الحاضرون" value={stats.present} tone="primary" />
              <SummaryRow label="الغائبون والمتأخرون" value={stats.absent} tone="muted" />
              <SummaryRow label="إجمالي الموظفين" value={stats.employees} tone="muted" />
            </div>
            <div className="mt-6 h-2 w-full overflow-hidden rounded-full bg-secondary">
              <div className="h-full rounded-full bg-primary" style={{ width: `${rate}%` }} />
            </div>
            <p className="mt-2 text-xs text-muted-foreground">نسبة الحضور اليوم {rate}%</p>
          </section>
        </div>

        <section className="rounded-2xl border border-dashed border-border bg-glass p-8 text-center backdrop-blur-xl">
          <div className="mx-auto grid size-11 place-items-center rounded-xl bg-primary/10 text-primary">
            <Sparkles className="size-5" />
          </div>
          <h3 className="mt-4 text-base font-bold text-foreground">تنبيهات ذكية</h3>
          <p className="mt-1 text-sm text-muted-foreground">
            ستظهر هنا التنبيهات والتحليلات الذكية لاحقاً.
          </p>
        </section>
      </div>
    </AppShell>
  );
}

function SummaryRow({
  label,
  value,
  tone,
}: {
  label: string;
  value: number;
  tone: "primary" | "muted";
}) {
  return (
    <div className="flex items-center justify-between gap-3">
      <span className="min-w-0 truncate text-sm text-muted-foreground">{label}</span>
      <span
        className={cn(
          "shrink-0 rounded-lg px-2.5 py-1 text-sm font-bold",
          tone === "primary" ? "bg-primary/10 text-primary" : "bg-secondary text-foreground",
        )}
      >
        {value}
      </span>
    </div>
  );
}
