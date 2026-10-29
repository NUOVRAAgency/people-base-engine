import { readLastSync, signOutAndClear, useOnline } from "@/lib/offline";
import { getLocale } from "@/lib/i18n";
import { WifiOff } from "lucide-react";
import { Link, useNavigate, useRouterState } from "@tanstack/react-router";
import {
  ArrowLeft,
  BarChart3,
  Bell,
  CalendarCheck,
  FileText,
  Home,
  LogOut,
  Plane,
  Search,
  Settings,
  Users,
  Wallet,
} from "lucide-react";
import { useEffect, useRef, type ReactNode } from "react";
import { ROLE_LABELS, useCurrentUser } from "@/hooks/use-current-user";
import { useHeaderData } from "@/hooks/use-header-data";
import { Button } from "@/components/ui/button";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { cn } from "@/lib/utils";
import { supabase } from "@/integrations/supabase/client";


import { tr, trf } from "@/lib/i18n";
type NavItem = {
  to: "/dashboard" | "/employees" | "/attendance" | "/leaves" | "/payroll" | "/reports" | "/settings";
  label: string;
  icon: typeof Home;
  adminOnly?: boolean;
};

const NAV_ITEMS: NavItem[] = [
  { to: "/dashboard", label: tr("الرئيسية"), icon: Home },
  { to: "/employees", label: tr("الموظفون"), icon: Users },
  { to: "/attendance", label: tr("الحضور"), icon: CalendarCheck },
  { to: "/leaves", label: tr("الإجازات"), icon: Plane },
  { to: "/payroll", label: tr("الرواتب"), icon: Wallet, adminOnly: true },
  { to: "/reports", label: tr("التقارير"), icon: BarChart3 },
  { to: "/settings", label: tr("الإعدادات"), icon: Settings },
];

const TITLES: Record<string, string> = {
  "/dashboard": tr("الرئيسية"),
  "/employees": tr("الموظفون"),
  "/attendance": tr("الحضور"),
  "/leaves": tr("الإجازات"),
  "/payroll": tr("الرواتب"),
  "/reports": tr("التقارير"),
  "/settings": tr("الإعدادات"),
  "/settings/system": tr("إعدادات النظام"),
  "/account": tr("الحساب"),
  "/users": tr("المستخدمون"),
  "/journal": tr("القيود اليومية"),
};

export function MobileShell({ children }: { children: ReactNode }) {
  const pathname = useRouterState({ select: (s) => s.location.pathname });
  const navigate = useNavigate();
  const title = TITLES[pathname] ?? tr("نظام الموارد البشرية");
  const { isAdmin, role } = useCurrentUser();
  const online = useOnline();
  const lastSync = online ? null : readLastSync();
  const { companyName, notifications } = useHeaderData();
  const companyNameIsArabic = /[\u0600-\u06ff]/.test(companyName);
  const listRef = useRef<HTMLUListElement>(null);

  useEffect(() => {
    const list = listRef.current;
    if (!list) return;
    const active = list.querySelector<HTMLElement>('[data-active="true"]');
    active?.scrollIntoView({ behavior: "smooth", inline: "center", block: "nearest" });
  }, [pathname]);

  const visibleItems = NAV_ITEMS.filter((item) => !item.adminOnly || isAdmin);

  return (
    <div className="min-h-dvh bg-background font-kufi">
      <aside className="fixed inset-y-0 start-0 z-40 hidden w-60 flex-col border-e border-border bg-card text-foreground shadow-nav md:flex">
        <div className="flex items-center gap-2.5 border-b border-border px-4 py-5">
          <span className="flex size-10 shrink-0 items-center justify-center rounded-xl bg-primary text-primary-foreground">
            <Users className="h-5 w-5" aria-hidden />
          </span>
          <span dir="auto" className="min-w-0 truncate text-sm font-bold text-foreground">{companyName || tr("نظام الموارد البشرية")}</span>
        </div>
        <nav className="flex-1 overflow-y-auto p-3">
          <ul className="space-y-2.5">
            {visibleItems.map((item) => {
              const active = pathname === item.to || pathname.startsWith(`${item.to}/`);
              const Icon = item.icon;
              return (
                <li key={item.to}>
                  <Link to={item.to} className={cn("flex items-center gap-3 rounded-xl border-2 px-3 py-3 text-sm font-normal text-primary-foreground transition-all [background:var(--header-gradient)] hover:brightness-110", active ? "border-primary-foreground shadow-card" : "border-transparent")}>
                    <Icon className="h-5 w-5 shrink-0" aria-hidden />
                    <span>{item.label}</span>
                  </Link>
                </li>
              );
            })}
          </ul>
        </nav>
        <div className="border-t border-border p-3">
          <p className="px-3 pb-2 text-xs text-muted-foreground">{role ? ROLE_LABELS[role] : ""}</p>
          <button
            type="button"
            onClick={async () => { await signOutAndClear(); navigate({ to: "/auth", replace: true }); }}
            className="flex w-full items-center gap-3 rounded-xl px-3 py-2.5 text-sm text-foreground transition-colors hover:bg-muted"
          >
            <LogOut className="h-5 w-5" aria-hidden />
            {tr("تسجيل الخروج")}
          </button>
        </div>
      </aside>

      <header className="fixed end-0 start-0 top-0 md:start-60 z-30 overflow-hidden rounded-b-2xl shadow-nav backdrop-blur-md">
        <div className="w-full bg-white pt-[max(7px,env(safe-area-inset-top))]" />
        <div className="relative flex h-[52px] items-center gap-3 px-3 text-primary-foreground [background:var(--header-gradient)] md:h-[56px] md:px-6">
        <div className="flex min-w-0 items-center gap-2.5">
          {companyName ? (
            <span
              dir="auto"
              className={cn(
                "hidden max-w-[180px] truncate rounded-full border border-white/25 bg-white/15 px-3 py-1 text-[12px] font-bold leading-[1.5] md:inline-block",
                companyNameIsArabic ? "font-kufi" : "font-sans",
              )}
            >
              {companyName}
            </span>
          ) : null}
          <h1 className="truncate rounded-full bg-white px-3.5 py-1 text-[13px] font-bold leading-[1.5] text-header-deep md:text-base">{title}</h1>
        </div>

        <div className="hidden min-w-0 flex-1 justify-center md:flex">
          <form className="relative w-full max-w-sm" role="search" onSubmit={(e) => e.preventDefault()}>
            <input
              type="search"
              aria-label={tr("بحث سريع")}
              placeholder={tr("بحث سريع…")}
              className="h-9 w-full rounded-full border border-white/25 bg-white/15 pe-10 ps-4 text-sm text-white outline-none transition-colors placeholder:text-white/65 focus:bg-white/25"
            />
            <button type="submit" aria-label={tr("بحث سريع")} className="absolute end-1 top-1/2 flex size-7 -translate-y-1/2 cursor-pointer items-center justify-center rounded-full text-white/80 transition-colors hover:bg-white/20 hover:text-white">
              <Search className="h-4 w-4" aria-hidden />
            </button>
          </form>
        </div>

        <div className="ms-auto flex shrink-0 items-center gap-1 md:ms-0">




          {pathname !== "/dashboard" ? (
            <Button
              type="button"
              variant="ghost"
              size="icon"
              aria-label={getLocale().startsWith("en") ? "Back" : "رجوع"}
              className="text-primary-foreground hover:bg-primary-foreground/15 hover:text-primary-foreground"
              onClick={() => {
                if (window.history.length > 1) window.history.back();
                else navigate({ to: "/dashboard" });
              }}
            >
              <ArrowLeft className="h-5 w-5 rtl:rotate-180" aria-hidden />
            </Button>
          ) : (
          <Popover>
            <PopoverTrigger asChild>
              <Button
                type="button"
                variant="ghost"
                size="icon"
                aria-label={trf("التنبيهات{0}", notifications.length ? trf("، {0} جديدة", notifications.length) : "")}
                className="relative text-primary-foreground hover:bg-primary-foreground/15 hover:text-primary-foreground"
              >
                <Bell className="h-5 w-5" aria-hidden />
                {notifications.length > 0 ? (
                  <span className="absolute end-1.5 top-1.5 flex h-2.5 w-2.5 rounded-full border-2 border-header-blue bg-destructive" />
                ) : null}
              </Button>
            </PopoverTrigger>
            <PopoverContent align="end" sideOffset={10} className="w-[min(340px,calc(100vw-24px))] rounded-lg border-border/80 p-0 shadow-card">
              <div className="border-b border-border px-4 py-3">
                <p className="text-sm font-bold">{tr("التنبيهات الإدارية")}</p>
                <p className="mt-0.5 text-xs text-muted-foreground">{tr("آخر تحديثات الحضور والتقارير")}</p>
              </div>
              <div className="max-h-80 overflow-y-auto p-2">
                {notifications.length ? notifications.map((notification) => {
                  const Icon = notification.kind === "attendance" ? CalendarCheck : FileText;
                  return (
                    <Button
                      key={notification.id}
                      type="button"
                      variant="ghost"
                      className="h-auto w-full justify-start gap-3 whitespace-normal rounded-md px-2.5 py-3 text-start"
                      onClick={() => navigate({ to: notification.to })}
                    >
                      <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full bg-primary/10 text-primary">
                        <Icon className="h-4 w-4" aria-hidden />
                      </span>
                      <span className="min-w-0 flex-1">
                        <span className="block text-sm font-bold text-foreground">{notification.title}</span>
                        <span className="mt-0.5 block text-xs leading-5 text-muted-foreground">{notification.detail}</span>
                      </span>
                    </Button>
                  );
                }) : (
                  <p className="px-3 py-8 text-center text-sm text-muted-foreground">{tr("لا توجد تنبيهات حالياً")}</p>
                )}
              </div>
            </PopoverContent>
          </Popover>
          )}
        </div>
        </div>
      </header>

      <main className="min-h-dvh bg-background px-4 pb-[96px] md:pb-8 md:ps-[calc(15rem+1.5rem)] pt-[calc(max(7px,env(safe-area-inset-top))+64px)] md:px-6 md:pt-[calc(max(7px,env(safe-area-inset-top))+68px)]">
        {!online ? (
          <div role="status" className="mx-auto mb-3 flex w-full max-w-6xl items-center gap-2 rounded-xl border border-warning/40 bg-warning/15 px-3 py-2 text-xs text-warning-foreground">
            <WifiOff className="h-4 w-4 shrink-0" aria-hidden />
            <span className="font-bold">{tr("لا يوجد اتصال - وضع القراءة فقط")}</span>
            {lastSync ? (
              <span className="ms-auto">{trf("آخر مزامنة: {0}", new Intl.DateTimeFormat(getLocale(), { dateStyle: "medium", timeStyle: "short" }).format(new Date(lastSync)))}</span>
            ) : null}
          </div>
        ) : null}
        {children}
      </main>

      <nav className="fixed inset-x-0 bottom-0 z-30 md:hidden border-t border-border bg-card/95 backdrop-blur-md">
        <ul ref={listRef} className="scrollbar-hide mx-auto flex max-w-[480px] items-stretch gap-1 overflow-x-auto px-3 pb-[env(safe-area-inset-bottom)]">
          {visibleItems.map((item) => {
            const active = pathname === item.to;
            const Icon = item.icon;
            return (
              <li key={item.to} className="shrink-0">
                <Link to={item.to} data-active={active} className={cn("flex w-[68px] flex-col items-center gap-1 py-2.5 text-[12px] transition-colors", active ? "text-primary" : "text-muted-foreground")}>
                  <span className={cn("flex h-9 w-14 items-center justify-center rounded-full transition-colors", active ? "bg-primary/10" : "bg-transparent")}>
                    <Icon className="h-5 w-5" aria-hidden />
                  </span>
                  <span className="font-medium leading-[1.5]">{item.label}</span>
                </Link>
              </li>
            );
          })}
        </ul>
      </nav>
    </div>
  );
}
