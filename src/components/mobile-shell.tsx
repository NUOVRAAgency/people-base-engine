import { Link, useRouterState } from "@tanstack/react-router";
import { CalendarCheck, Home, User, Users } from "lucide-react";
import type { ReactNode } from "react";

type NavItem = {
  to: "/dashboard" | "/employees" | "/attendance" | "/account";
  label: string;
  icon: typeof Home;
};

const NAV_ITEMS: NavItem[] = [
  { to: "/dashboard", label: "الرئيسية", icon: Home },
  { to: "/employees", label: "الموظفين", icon: Users },
  { to: "/attendance", label: "الحضور", icon: CalendarCheck },
  { to: "/account", label: "الحساب", icon: User },
];

const TITLES: Record<string, string> = {
  "/dashboard": "الرئيسية",
  "/employees": "الموظفين",
  "/attendance": "الحضور",
  "/account": "الحساب",
  "/payroll": "الرواتب",
  "/settings": "الإعدادات",
  "/users": "المستخدمون",
};

export function MobileShell({ children }: { children: ReactNode }) {
  const pathname = useRouterState({ select: (s) => s.location.pathname });
  const title = TITLES[pathname] ?? "نظام الموارد البشرية";

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
        <ul className="mx-auto flex max-w-[480px] items-stretch justify-between px-2 pb-[env(safe-area-inset-bottom)]">
          {NAV_ITEMS.map((item) => {
            const active = pathname === item.to;
            const Icon = item.icon;
            return (
              <li key={item.to} className="flex-1">
                <Link
                  to={item.to}
                  className={`flex flex-col items-center gap-1 py-2.5 text-[12px] transition-colors ${
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
