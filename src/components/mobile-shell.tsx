import { Link, useNavigate, useRouterState } from "@tanstack/react-router";
import {
  BarChart3,
  Bell,
  CalendarCheck,
  FileText,
  Home,
  Plane,
  Search,
  Settings,
  Users,
  Wallet,
} from "lucide-react";
import { useEffect, useRef, type ReactNode } from "react";
import { useCurrentUser } from "@/hooks/use-current-user";
import { useHeaderData } from "@/hooks/use-header-data";
import { Button } from "@/components/ui/button";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { cn } from "@/lib/utils";


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
};

export function MobileShell({ children }: { children: ReactNode }) {
  const pathname = useRouterState({ select: (s) => s.location.pathname });
  const navigate = useNavigate();
  const title = TITLES[pathname] ?? tr("نظام الموارد البشرية");
  const { isAdmin } = useCurrentUser();
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
    <div dir="rtl" className="min-h-dvh bg-background font-kufi">
      <header className="fixed inset-x-0 top-0 z-30 overflow-hidden rounded-b-2xl shadow-nav backdrop-blur-md">
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
          <div className="relative w-full max-w-sm">
            <Search className="pointer-events-none absolute end-3 top-1/2 h-4 w-4 -translate-y-1/2 text-white/70" aria-hidden />
            <input
              type="search"
              aria-label={tr("بحث سريع")}
              placeholder={tr("بحث سريع…")}
              className="h-9 w-full rounded-full border border-white/25 bg-white/15 pe-9 ps-4 text-sm text-white outline-none transition-colors placeholder:text-white/65 focus:bg-white/25"
            />
          </div>
        </div>

        <div className="ms-auto flex shrink-0 items-center gap-1 md:ms-0">





          <Popover>
            <PopoverTrigger asChild>
              <Button
                type="button"
                variant="ghost"
                size="icon"
                aria-label={trf("التنبيهات{0}", notifications.length ? `، ${notifications.length} جديدة` : "")}
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
                      className="h-auto w-full justify-start gap-3 whitespace-normal rounded-md px-2.5 py-3 text-right"
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
        </div>
        </div>
      </header>

      <main className="min-h-dvh bg-background px-4 pb-[96px] pt-[calc(max(7px,env(safe-area-inset-top))+64px)] md:px-6 md:pt-[calc(max(7px,env(safe-area-inset-top))+68px)]">{children}</main>

      <nav className="fixed inset-x-0 bottom-0 z-30 border-t border-border bg-card/95 backdrop-blur-md">
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
