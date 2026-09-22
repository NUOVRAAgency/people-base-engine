import { Link, useRouterState } from "@tanstack/react-router";
import {
  BarChart3,
  Bot,
  CalendarDays,
  Home,
  UsersRound,
  WalletCards,
} from "lucide-react";
import type { ReactNode } from "react";
import { useCurrentUser } from "@/hooks/use-current-user";
import { cn } from "@/lib/utils";

const items = [
  { to: "/dashboard" as const, label: "الرئيسية", icon: Home },
  { to: "/employees" as const, label: "الموظفون", icon: UsersRound },
  { to: "/users" as const, label: "المساعد", icon: Bot, center: true },
  { to: "/payroll" as const, label: "الرواتب", icon: WalletCards, adminOnly: true },
  { to: "/settings" as const, label: "التقارير", icon: BarChart3 },
];

export function MobilePage({ children, className, withNav = true }: { children: ReactNode; className?: string; withNav?: boolean }) {
  return (
    <main className="min-h-dvh bg-page text-foreground" dir="rtl">
      <div className={cn("mx-auto min-h-dvh w-full max-w-[430px] px-4 pt-[max(1rem,env(safe-area-inset-top))]", withNav && "pb-28", className)}>
        {children}
      </div>
      {withNav ? <MobileNav /> : null}
    </main>
  );
}

export function MobileNav() {
  const pathname = useRouterState({ select: (state) => state.location.pathname });
  const { isAdmin } = useCurrentUser();
  const visible = items.filter((item) => !item.adminOnly || isAdmin);
  return (
    <nav className="fixed inset-x-0 bottom-0 z-50 mx-auto w-full max-w-[430px] border-t border-border/70 bg-card/95 px-3 pb-[max(.55rem,env(safe-area-inset-bottom))] pt-2 shadow-mobile-nav backdrop-blur-xl" aria-label="التنقل الرئيسي">
      <div className="grid grid-flow-col auto-cols-fr items-end">
        {visible.map(({ to, label, icon: Icon, center }) => {
          const active = pathname === to;
          return (
            <Link key={to} to={to} className={cn("flex min-w-0 flex-col items-center gap-1 text-[10px] font-medium text-muted-foreground", active && "text-primary")}>
              <span className={cn("grid size-9 place-items-center rounded-full transition-colors", active && "bg-primary/10", center && "-mt-6 size-13 border-4 border-page bg-primary text-primary-foreground shadow-nav", center && !active && "text-primary-foreground")}>
                <Icon className={cn("size-[18px]", center && "size-5")} strokeWidth={2.2} />
              </span>
              <span className="truncate">{label}</span>
            </Link>
          );
        })}
      </div>
    </nav>
  );
}

export function PageHeader({ title, eyebrow, back, action }: { title: string; eyebrow?: string; back?: ReactNode; action?: ReactNode }) {
  return (
    <header className="grid grid-cols-[2.75rem_minmax(0,1fr)_2.75rem] items-center gap-2 py-3">
      <div>{back}</div>
      <div className="min-w-0 text-center">
        {eyebrow ? <p className="truncate text-[10px] font-medium text-muted-foreground">{eyebrow}</p> : null}
        <h1 className="truncate text-[20px] font-bold">{title}</h1>
      </div>
      <div>{action}</div>
    </header>
  );
}

export function SectionTitle({ children, action }: { children: ReactNode; action?: ReactNode }) {
  return <div className="mb-3 mt-5 flex items-center justify-between gap-3"><h2 className="text-[15px] font-semibold">{children}</h2>{action}</div>;
}

export function EmptyState({ icon: Icon = CalendarDays, title, text }: { icon?: typeof CalendarDays; title: string; text: string }) {
  return <div className="rounded-xl bg-card px-5 py-8 text-center shadow-card"><Icon className="mx-auto mb-3 size-6 text-primary"/><h3 className="text-sm font-semibold">{title}</h3><p className="mt-1 text-xs leading-5 text-muted-foreground">{text}</p></div>;
}
