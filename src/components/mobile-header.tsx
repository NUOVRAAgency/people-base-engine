import { Link, useRouterState } from "@tanstack/react-router";
import type { ReactNode } from "react";
import { useCurrentUser } from "@/hooks/use-current-user";
import { cn } from "@/lib/utils";

/**
 * الهيدر العلوي للهاتف — ارتفاع ثابت 98px بعرض الشاشة كاملاً.
 * الخلفية: تدرج خطي من #0C4BBC (أعلى) إلى #0055FF (أسفل).
 */
export function MobileHeader({ children }: { children?: ReactNode }) {
  return (
    <header
      dir="rtl"
      className="h-[98px] w-full shrink-0 text-primary-foreground"
      style={{
        background: "var(--header-gradient)",
      }}
    >
      {children}
    </header>
  );
}

const TABS = [
  { to: "/dashboard" as const, label: "الرئيسية" },
  { to: "/employees" as const, label: "الموظفون" },
  { to: "/attendance" as const, label: "الحضور" },
  { to: "/payroll" as const, label: "الرواتب", adminOnly: true },
  { to: "/settings" as const, label: "التقارير" },
];

/**
 * شريط التبويبات الأفقي داخل الهيدر.
 * غير النشط: نص أبيض ناصع بدون خلفية — النشط: مستطيل أبيض pill بنص أزرق الهيدر.
 */
export function MobileTabs() {
  const pathname = useRouterState({ select: (state) => state.location.pathname });
  const { isAdmin } = useCurrentUser();
  const visible = TABS.filter((tab) => !tab.adminOnly || isAdmin);
  return (
    <nav dir="rtl" aria-label="أقسام النظام" className="font-kufi flex items-center gap-5 overflow-x-auto px-3 pb-4 pt-2 [scrollbar-width:none] [&::-webkit-scrollbar]:hidden">
      {visible.map(({ to, label }) => {
        const active = pathname === to;
        return (
          <Link
            key={to}
            to={to}
            className={cn(
              "shrink-0 rounded-full px-6 py-1.5 text-[20px] font-normal leading-9 whitespace-nowrap transition-colors duration-150",
              active
                ? "bg-card text-primary shadow-sm"
                : "bg-transparent text-primary-foreground"
            )}
          >
            {label}
          </Link>
        );
      })}
    </nav>
  );
}
