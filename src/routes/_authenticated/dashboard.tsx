import { createFileRoute } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Users, UserCheck, Wallet, UserX, Bell } from "lucide-react";

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

const TABS = ["الرئيسية", "الموظفون", "الحضور", "الرواتب", "التقارير"];

const STATS = [
  { label: "إجمالي الموظفين", value: "24", Icon: Users },
  { label: "الحاضرون اليوم", value: "21", Icon: UserCheck },
  { label: "إجمالي رواتب الشهر", value: "86,400", Icon: Wallet },
  { label: "المتأخرون/الغائبون اليوم", value: "3", Icon: UserX },
];

function Dashboard() {
  const [activeTab, setActiveTab] = useState("الرئيسية");
  const [scrolled, setScrolled] = useState(false);
  const [userName, setUserName] = useState("مدير النظام");
  const [today, setToday] = useState("");

  useEffect(() => {
    const onScroll = () => setScrolled(window.scrollY > 8);
    window.addEventListener("scroll", onScroll, { passive: true });
    return () => window.removeEventListener("scroll", onScroll);
  }, []);

  useEffect(() => {
    supabase.auth.getUser().then(({ data }) => {
      const email = data.user?.email;
      if (email) setUserName(email.split("@")[0]);
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

  return (
    <div className="min-h-screen bg-background">
      {/* الشريط العلوي */}
      <header
        className={
          "fixed inset-x-0 top-0 z-50 border-b border-white/15 backdrop-blur-xl transition-shadow duration-300 " +
          (scrolled ? "shadow-glass" : "")
        }
        style={{ backgroundColor: "var(--header-blue)" }}
      >
        <div className="mx-auto flex h-16 max-w-6xl items-center gap-4 px-4 sm:px-6">
          <div className="hidden shrink-0 items-center gap-2.5 md:flex">
            <div className="flex h-9 w-9 items-center justify-center rounded-xl bg-white/15 text-sm font-bold text-white">
              HR
            </div>
            <span className="text-sm font-semibold text-white">الموارد البشرية</span>
          </div>

          <nav className="flex flex-1 items-center gap-1.5 overflow-x-auto md:justify-center [scrollbar-width:none] [&::-webkit-scrollbar]:hidden">
            {TABS.map((tab) => (
              <button
                key={tab}
                type="button"
                onClick={() => setActiveTab(tab)}
                className={
                  "whitespace-nowrap rounded-lg px-3.5 py-2 text-sm transition sm:px-4 " +
                  (activeTab === tab
                    ? "bg-white/20 font-semibold text-white shadow-sm"
                    : "text-white/80 hover:bg-white/10 hover:text-white")
                }
              >
                {tab}
              </button>
            ))}
          </nav>
        </div>
      </header>

      <main className="mx-auto max-w-6xl px-4 pb-16 pt-24 sm:px-6 sm:pt-28">
        {/* الترحيب */}
        <div>
          <h1 className="text-2xl font-bold tracking-tight text-foreground sm:text-3xl">
            مرحبًا، {userName}
          </h1>
          <p className="mt-1.5 text-sm text-muted-foreground sm:text-base">{today}</p>
        </div>

        {/* بطاقات الإحصائيات */}
        <div className="mt-8 grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-4">
          {STATS.map(({ label, value, Icon }) => (
            <div
              key={label}
              className="rounded-2xl border border-glass-border bg-glass p-5 shadow-glass backdrop-blur-xl transition-transform duration-200 hover:-translate-y-0.5"
            >
              <div className="flex items-center justify-between">
                <span className="flex h-10 w-10 items-center justify-center rounded-xl bg-primary/10 text-primary">
                  <Icon className="h-5 w-5" />
                </span>
              </div>
              <p className="mt-4 text-3xl font-bold tracking-tight text-foreground">{value}</p>
              <p className="mt-1 text-sm text-muted-foreground">{label}</p>
            </div>
          ))}
        </div>

        {/* تنبيهات ذكية */}
        <section className="mt-8 rounded-2xl border border-glass-border bg-glass p-6 shadow-glass backdrop-blur-xl">
          <div className="flex items-center gap-2.5">
            <span className="flex h-9 w-9 items-center justify-center rounded-xl bg-primary/10 text-primary">
              <Bell className="h-4.5 w-4.5" />
            </span>
            <h2 className="text-lg font-semibold text-foreground">تنبيهات ذكية</h2>
          </div>
          <div className="mt-5 flex min-h-24 items-center justify-center rounded-xl border border-dashed border-border/70 px-4">
            <p className="text-sm text-muted-foreground">
              لا توجد تنبيهات حاليًا — ستظهر الإشعارات الذكية هنا
            </p>
          </div>
        </section>
      </main>
    </div>
  );
}
