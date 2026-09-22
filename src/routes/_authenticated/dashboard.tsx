import { createFileRoute, Link } from "@tanstack/react-router";
import { Bell, CalendarDays, Clock3, UserRoundPlus, UsersRound, WalletCards } from "lucide-react";
import { useEffect, useState } from "react";
import { MobilePage, SectionTitle } from "@/components/mobile-hr";
import { Avatar, AvatarFallback } from "@/components/ui/avatar";
import { Button } from "@/components/ui/button";
import { useCurrentUser } from "@/hooks/use-current-user";
import { supabase } from "@/integrations/supabase/client";

export const Route = createFileRoute("/_authenticated/dashboard")({
  head: () => ({ meta: [{ title: "مساحة العمل | نظام الموارد البشرية" }, { name: "description", content: "ملخص فريق العمل والحضور" }, { property: "og:title", content: "مساحة العمل | نظام الموارد البشرية" }, { property: "og:description", content: "ملخص فريق العمل والحضور" }, { property: "og:type", content: "website" }, { name: "twitter:card", content: "summary_large_image" }] }),
  component: DashboardPage,
});

type Stats = { staff: number; attendance: number; pending: number };
function DashboardPage() {
  const { fullName, initials, isAdmin } = useCurrentUser();
  const [stats, setStats] = useState<Stats>({ staff: 0, attendance: 0, pending: 0 });
  useEffect(() => {
    let active = true;
    void (async () => {
      const today = new Date().toISOString().slice(0, 10);
      const [{ count: staff }, { data: attendance }] = await Promise.all([
        supabase.from("employees").select("id", { count: "exact", head: true }),
        supabase.from("attendance").select("status").eq("date", today),
      ]);
      if (!active) return;
      const rows = attendance ?? [];
      const present = rows.filter((row) => row.status === "present").length;
      setStats({ staff: staff ?? 0, attendance: rows.length ? Math.round((present / rows.length) * 100) : 0, pending: rows.filter((row) => row.status !== "present").length });
    })();
    return () => { active = false; };
  }, []);
  const firstName = fullName?.split(" ")[0] || "بك";
  const quick = [
    { label: "إضافة موظف", icon: UserRoundPlus, to: "/employees" as const },
    { label: "الجدولة", icon: CalendarDays, to: "/attendance" as const },
    { label: "الحضور", icon: Clock3, to: "/attendance" as const },
    ...(isAdmin ? [{ label: "الرواتب", icon: WalletCards, to: "/payroll" as const }] : []),
  ];
  return <MobilePage>
    <header className="grid grid-cols-[auto_minmax(0,1fr)_auto] items-center gap-3 py-3">
      <Avatar className="size-11 border-2 border-card shadow-sm"><AvatarFallback className="bg-primary/10 font-bold text-primary">{initials}</AvatarFallback></Avatar>
      <div className="min-w-0"><p className="text-xs text-muted-foreground">صباح الخير، {firstName}</p><h1 className="truncate text-[22px] font-bold">مساحة عملك</h1></div>
      <Button size="icon" variant="ghost" className="rounded-full bg-card shadow-sm" aria-label="الإشعارات"><Bell /></Button>
    </header>

    <section className="mt-3 overflow-hidden rounded-xl bg-primary p-5 text-primary-foreground shadow-card">
      <div className="mb-7 flex items-center justify-between"><div><p className="text-xs text-primary-foreground/75">فريقك اليوم</p><p className="mt-1 text-lg font-semibold">نظرة سريعة</p></div><CalendarDays className="size-6 opacity-80"/></div>
      <div className="grid grid-cols-3 gap-3">
        {[['إجمالي الموظفين', stats.staff], ['الحضور', `${stats.attendance}%`], ['المعلّق', stats.pending]].map(([label, value]) => <div key={label} className="min-w-0"><p className="text-[10px] text-primary-foreground/70">{label}</p><strong className="mt-1 block text-2xl">{value}</strong></div>)}
      </div>
    </section>

    <SectionTitle>إجراءات سريعة</SectionTitle>
    <div className="grid grid-cols-4 gap-2">{quick.map(({ label, icon: Icon, to }) => <Link key={label} to={to} className="flex min-w-0 flex-col items-center gap-2 text-center text-[10px] font-medium"><span className="grid size-13 place-items-center rounded-xl bg-card shadow-sm"><Icon className="size-5 text-primary"/></span><span className="truncate">{label}</span></Link>)}</div>

    <SectionTitle action={<span className="text-[11px] font-medium text-primary">اليوم</span>}>الإشعارات</SectionTitle>
    <div className="rounded-xl bg-card p-4 shadow-card"><div className="flex items-start gap-3"><Avatar className="size-10"><AvatarFallback className="bg-primary/10 text-xs text-primary">HR</AvatarFallback></Avatar><div className="min-w-0 flex-1"><div className="flex items-center justify-between gap-2"><p className="truncate text-sm font-semibold">ملخص فريق العمل</p><span className="text-[10px] text-muted-foreground">الآن</span></div><p className="mt-1 text-xs leading-5 text-muted-foreground">لا توجد طلبات جديدة تحتاج إلى إجراء في الوقت الحالي.</p></div></div></div>
  </MobilePage>;
}
