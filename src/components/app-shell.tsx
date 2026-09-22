import { Link, useRouterState, useNavigate } from "@tanstack/react-router";
import { useState } from "react";
import {
  LayoutDashboard,
  Users,
  CalendarCheck,
  Wallet,
  ShieldCheck,
  Settings,
  Languages,
  Bell,
  Search,
  Menu,
  X,
  LogOut,
} from "lucide-react";
import { cn } from "@/lib/utils";
import { supabase } from "@/integrations/supabase/client";
import { useCurrentUser, ROLE_LABELS } from "@/hooks/use-current-user";

type NavItem = {
  to: string;
  label: string;
  icon: typeof Users;
  adminOnly?: boolean;
};

const NAV_ITEMS: NavItem[] = [
  { to: "/dashboard", label: "الرئيسية", icon: LayoutDashboard },
  { to: "/employees", label: "الموظفون", icon: Users },
  { to: "/attendance", label: "الحضور والغياب", icon: CalendarCheck },
  { to: "/payroll", label: "الرواتب", icon: Wallet, adminOnly: true },
  { to: "/users", label: "إدارة المستخدمين والصلاحيات", icon: ShieldCheck, adminOnly: true },
  { to: "/settings", label: "الإعدادات", icon: Settings },
];

function Brand() {
  return (
    <div className="flex min-w-0 items-center gap-3">
      <div className="grid size-10 shrink-0 place-items-center rounded-2xl bg-primary text-primary-foreground shadow-nav">
        <ShieldCheck className="size-5" />
      </div>
      <div className="min-w-0">
        <p className="truncate text-sm font-bold text-foreground">نظام الموارد البشرية</p>
        <p className="truncate text-xs text-muted-foreground">إدارة فريق العمل</p>
      </div>
    </div>
  );
}

function NavList({
  items,
  pathname,
  onNavigate,
}: {
  items: NavItem[];
  pathname: string;
  onNavigate?: () => void;
}) {
  return (
    <nav className="flex flex-col gap-1">
      {items.map((item) => {
        const active = pathname === item.to;
        const Icon = item.icon;
        return (
          <Link
            key={item.to}
            to={item.to}
            onClick={onNavigate}
            className={cn(
              "flex items-center gap-3 rounded-xl px-3 py-2.5 text-sm font-medium transition-colors",
              active
                ? "bg-primary text-primary-foreground shadow-nav"
                : "text-muted-foreground hover:bg-secondary hover:text-foreground",
            )}
          >
            <Icon className="size-[18px] shrink-0" />
            <span className="truncate">{item.label}</span>
          </Link>
        );
      })}
    </nav>
  );
}

function LanguageToggle({ className }: { className?: string }) {
  const [lang, setLang] = useState<"AR" | "EN">("AR");
  return (
    <button
      type="button"
      onClick={() => setLang((l) => (l === "AR" ? "EN" : "AR"))}
      className={cn(
        "flex items-center gap-2 rounded-xl border border-border px-3 py-2 text-xs font-semibold text-foreground transition-colors hover:bg-secondary",
        className,
      )}
      aria-label="تبديل اللغة"
    >
      <Languages className="size-4 text-muted-foreground" />
      <span>{lang === "AR" ? "العربية" : "English"}</span>
    </button>
  );
}

function Avatar({ initials }: { initials: string }) {
  return (
    <div className="grid size-9 shrink-0 place-items-center rounded-full bg-primary/10 text-xs font-bold text-primary">
      {initials}
    </div>
  );
}

export function AppShell({ title, children }: { title: string; children: React.ReactNode }) {
  const { fullName, role, initials } = useCurrentUser();
  const pathname = useRouterState({ select: (s) => s.location.pathname });
  const navigate = useNavigate();
  const [menuOpen, setMenuOpen] = useState(false);

  const items = NAV_ITEMS.filter((i) => !i.adminOnly || role === "admin");

  const signOut = async () => {
    await supabase.auth.signOut();
    navigate({ to: "/auth", replace: true });
  };

  return (
    <div className="min-h-dvh bg-page" dir="rtl">
      {/* الشريط الجانبي — الحاسوب */}
      <aside className="fixed inset-y-0 right-0 z-30 hidden w-72 flex-col border-l border-border bg-card px-4 py-6 lg:flex">
        <Brand />
        <div className="mt-8 min-h-0 flex-1 overflow-y-auto">
          <p className="px-3 pb-2 text-[11px] font-semibold tracking-wide text-muted-foreground">
            الأقسام
          </p>
          <NavList items={items} pathname={pathname} />
          <div className="mt-4 border-t border-border pt-4">
            <LanguageToggle className="w-full justify-start" />
          </div>
        </div>
        <div className="mt-4 rounded-2xl border border-border bg-secondary/60 p-3">
          <div className="flex min-w-0 items-center gap-3">
            <Avatar initials={initials} />
            <div className="min-w-0 flex-1">
              <p className="truncate text-sm font-semibold text-foreground">{fullName || "—"}</p>
              <p className="truncate text-xs text-muted-foreground">
                {role ? ROLE_LABELS[role] : "—"}
              </p>
            </div>
            <button
              type="button"
              onClick={signOut}
              aria-label="تسجيل الخروج"
              className="grid size-8 shrink-0 place-items-center rounded-lg text-muted-foreground transition-colors hover:bg-card hover:text-foreground"
            >
              <LogOut className="size-4" />
            </button>
          </div>
        </div>
      </aside>

      <div className="lg:mr-72">
        {/* الهيدر العلوي — الهاتف */}
        <header className="sticky top-0 z-40 border-b border-border bg-glass backdrop-blur-xl lg:hidden">
          <div className="grid grid-cols-[minmax(0,1fr)_auto] items-center gap-3 px-4 py-3">
            <Brand />
            <div className="flex shrink-0 items-center gap-1.5">
              <LanguageToggle className="px-2 py-1.5" />
              <button
                type="button"
                aria-label="الإشعارات"
                className="grid size-9 place-items-center rounded-xl border border-border bg-card text-muted-foreground"
              >
                <Bell className="size-4" />
              </button>
              <Avatar initials={initials} />
              <button
                type="button"
                aria-label="القائمة"
                onClick={() => setMenuOpen((o) => !o)}
                className="grid size-9 place-items-center rounded-xl border border-border bg-card text-foreground"
              >
                {menuOpen ? <X className="size-4" /> : <Menu className="size-4" />}
              </button>
            </div>
          </div>
          {menuOpen && (
            <div className="border-t border-border bg-card px-4 py-3">
              <NavList items={items} pathname={pathname} onNavigate={() => setMenuOpen(false)} />
              <button
                type="button"
                onClick={signOut}
                className="mt-2 flex w-full items-center gap-3 rounded-xl px-3 py-2.5 text-sm font-medium text-muted-foreground transition-colors hover:bg-secondary"
              >
                <LogOut className="size-[18px]" />
                تسجيل الخروج
              </button>
            </div>
          )}
        </header>

        {/* الهيدر العلوي — الحاسوب */}
        <header className="sticky top-0 z-20 hidden border-b border-border bg-glass px-8 py-4 backdrop-blur-xl lg:block">
          <div className="flex items-center justify-between gap-4">
            <h1 className="truncate text-lg font-bold text-foreground">{title}</h1>
            <div className="flex shrink-0 items-center gap-2">
              <button
                type="button"
                aria-label="بحث"
                className="grid size-10 place-items-center rounded-xl border border-border bg-card text-muted-foreground transition-colors hover:text-foreground"
              >
                <Search className="size-4" />
              </button>
              <button
                type="button"
                aria-label="الإشعارات"
                className="relative grid size-10 place-items-center rounded-xl border border-border bg-card text-muted-foreground transition-colors hover:text-foreground"
              >
                <Bell className="size-4" />
                <span className="absolute left-2.5 top-2.5 size-1.5 rounded-full bg-primary" />
              </button>
              <Avatar initials={initials} />
            </div>
          </div>
        </header>

        <main className="px-4 py-6 sm:px-6 lg:px-8">{children}</main>
      </div>
    </div>
  );
}
