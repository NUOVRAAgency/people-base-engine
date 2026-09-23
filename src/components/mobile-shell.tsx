import { Link, useNavigate, useRouterState } from "@tanstack/react-router";
import {
  BarChart3,
  Bell,
  CalendarCheck,
  FileText,
  Home,
  Plane,
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


type NavItem = {
  to: "/dashboard" | "/employees" | "/attendance" | "/leaves" | "/payroll" | "/reports" | "/settings";
  label: string;
  icon: typeof Home;
  adminOnly?: boolean;
};

const NAV_ITEMS: NavItem[] = [
  { to: "/dashboard", label: "الرئيسية", icon: Home },
  { to: "/employees", label: "الموظفون", icon: Users },
  { to: "/attendance", label: "الحضور", icon: CalendarCheck },
  { to: "/leaves", label: "الإجازات", icon: Plane },
  { to: "/payroll", label: "الرواتب", icon: Wallet, adminOnly: true },
  { to: "/reports", label: "التقارير", icon: BarChart3 },
  { to: "/settings", label: "الإعدادات", icon: Settings },
];

const TITLES: Record<string, string> = {
  "/dashboard": "الرئيسية",
  "/employees": "الموظفون",
  "/attendance": "الحضور",
  "/leaves": "الإجازات",
  "/payroll": "الرواتب",
  "/reports": "التقارير",
  "/settings": "الإعدادات",
  "/settings/system": "إعدادات النظام",
  "/account": "الحساب",
  "/users": "المستخدمون",
};

export function MobileShell({ children }: { children: ReactNode }) {
  const pathname = useRouterState({ select: (s) => s.location.pathname });
  const navigate = useNavigate();
  const title = TITLES[pathname] ?? "نظام الموارد البشرية";
  const { isAdmin } = useCurrentUser();
  const { companyName, notifications } = useHeaderData();
  const companyNameIsArabic = /[\u0600-\u06ff]/.test(companyName);
  const glassMode = pathname === "/leaves";
  const listRef = useRef<HTMLUListElement>(null);

  useEffect(() => {
    const list = listRef.current;
    if (!list) return;
    const active = list.querySelector<HTMLElement>('[data-active="true"]');
    active?.scrollIntoView({ behavior: "smooth", inline: "center", block: "nearest" });
  }, [pathname]);

  const visibleItems = NAV_ITEMS.filter((item) => !item.adminOnly || isAdmin);

  return (
    <div dir="rtl" className={cn("min-h-dvh font-kufi", glassMode ? "app-night" : "bg-background")}>
      <header
        className={cn(
          "fixed inset-x-0 top-0 z-30 flex h-[62px] items-center justify-between px-4 text-primary-foreground",
          glassMode ? "glass-header" : "shadow-nav [background:var(--header-gradient)]",
        )}
      >
        <div className="flex min-w-0 items-center">
          <h1 className="truncate py-1 text-[18px] font-bold leading-[1.6]">{title}</h1>
        </div>

        {companyName ? (
          <p
            dir="auto"
            className={`pointer-events-none absolute left-1/2 max-w-[42%] -translate-x-1/2 truncate py-1 text-center text-[15px] font-bold leading-[1.6] text-primary-foreground ${companyNameIsArabic ? "font-kufi" : "font-sans"}`}
          >
            {companyName}
          </p>
        ) : null}

        <div className="flex shrink-0 items-center gap-1.5">


          <Popover>
            <PopoverTrigger asChild>
              <Button
                type="button"
                variant="ghost"
                size="icon"
                aria-label={`التنبيهات${notifications.length ? `، ${notifications.length} جديدة` : ""}`}
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
                <p className="text-sm font-bold">التنبيهات الإدارية</p>
                <p className="mt-0.5 text-xs text-muted-foreground">آخر تحديثات الحضور والتقارير</p>
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
                  <p className="px-3 py-8 text-center text-sm text-muted-foreground">لا توجد تنبيهات حالياً</p>
                )}
              </div>
            </PopoverContent>
          </Popover>
        </div>
      </header>

      <main className={cn("min-h-dvh px-4 pb-[96px] pt-[78px]", glassMode ? "app-night" : "bg-background")}>{children}</main>

      <nav className={cn("fixed inset-x-0 bottom-0 z-30", glassMode ? "glass-nav" : "border-t border-border bg-card/95 backdrop-blur-md")}>
        <ul ref={listRef} className="scrollbar-hide mx-auto flex max-w-[480px] items-stretch gap-1 overflow-x-auto px-3 pb-[env(safe-area-inset-bottom)]">
          {visibleItems.map((item) => {
            const active = pathname === item.to;
            const Icon = item.icon;
            return (
              <li key={item.to} className="shrink-0">
                <Link to={item.to} data-active={active} className={cn("flex w-[68px] flex-col items-center gap-1 py-2.5 text-[12px] transition-colors", glassMode ? (active ? "text-glass-foreground" : "text-glass-muted") : (active ? "text-primary" : "text-muted-foreground"))}>
                  <span className={cn("flex h-9 w-14 items-center justify-center rounded-full transition-colors", active ? (glassMode ? "bg-glass-surface ring-1 ring-glass-line" : "bg-primary/10") : "bg-transparent")}>
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
