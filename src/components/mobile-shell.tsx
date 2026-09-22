import { Link, useRouterState } from "@tanstack/react-router";
import {
  BarChart3,
  CalendarCheck,
  Home,
  Plane,
  Settings,
  Users,
  Wallet,
} from "lucide-react";
import { useEffect, useRef, type ReactNode } from "react";
import { useCurrentUser } from "@/hooks/use-current-user";

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
  "/account": "الحساب",
  "/users": "المستخدمون",
};

export function MobileShell({ children }: { children: ReactNode }) {
  const pathname = useRouterState({ select: (s) => s.location.pathname });
  const title = TITLES[pathname] ?? "نظام الموارد البشرية";
  const { isAdmin } = useCurrentUser();
  const listRef = useRef<HTMLUListElement>(null);

  // Scroll the active tab into view (RTL: starts from the right edge).
  useEffect(() => {
    const list = listRef.current;
    if (!list) return;
    const active = list.querySelector<HTMLElement>('[data-active="true"]');
    active?.scrollIntoView({ behavior: "smooth", inline: "center", block: "nearest" });
  }, [pathname]);

  const visibleItems = NAV_ITEMS.filter((item) => !item.adminOnly || isAdmin);

  return (
    <div dir="rtl" className="min-h-dvh bg-background font-kufi">
      <header
        className="fixed inset-x-0 top-0 z-30 flex h-[88px] items-end px-5 pb-3 text-primary-foreground"
        style={{ background: "var(--header-gradient)" }}
      >
        <h1 className="text-[22px] font-bold leading-none">{title}</h1>
      </header>

      <main className="min-h-dvh bg-background px-4 pt-[104px] pb-[96px]">{children}</main>

      <nav className="fixed inset-x-0 bottom-0 z-30 border-t border-border bg-card/95 backdrop-blur-md">
        <ul
          ref={listRef}
          className="scrollbar-hide mx-auto flex max-w-[480px] items-stretch gap-1 overflow-x-auto px-3 pb-[env(safe-area-inset-bottom)]"
        >
          {visibleItems.map((item) => {
            const active = pathname === item.to;
            const Icon = item.icon;
            return (
              <li key={item.to} className="shrink-0">
                <Link
                  to={item.to}
                  data-active={active}
                  className={`flex w-[68px] flex-col items-center gap-1 py-2.5 text-[12px] transition-colors ${
                    active ? "text-primary" : "text-muted-foreground"
                  }`}
                >
                  <span
                    className={`flex h-9 w-14 items-center justify-center rounded-full transition-colors ${
                      active ? "bg-primary/10" : "bg-transparent"
                    }`}
                  >
                    <Icon className="h-5 w-5" aria-hidden />
                  </span>
                  <span className="font-medium leading-none">{item.label}</span>
                </Link>
              </li>
            );
          })}
        </ul>
      </nav>
    </div>
  );
}
