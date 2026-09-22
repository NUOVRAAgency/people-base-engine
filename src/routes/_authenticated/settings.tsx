import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { ChevronLeft, ShieldCheck, UserCog, Users } from "lucide-react";
import { useCurrentUser } from "@/hooks/use-current-user";

export const Route = createFileRoute("/_authenticated/settings")({
  head: () => ({
    meta: [
      { title: "الإعدادات | نظام الموارد البشرية" },
      { name: "description", content: "الملف الشخصي وإدارة المستخدمين وإعدادات النظام" },
      { property: "og:title", content: "الإعدادات | نظام الموارد البشرية" },
      { property: "og:description", content: "الملف الشخصي وإدارة المستخدمين وإعدادات النظام" },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary_large_image" },
    ],
  }),
  component: SettingsPage,
});

function SettingsPage() {
  const navigate = useNavigate();
  const { isAdmin } = useCurrentUser();

  const sections = [
    { to: "/account", label: "الملف الشخصي", description: "بيانات حسابك وصلاحيتك", icon: UserCog },
    ...(isAdmin
      ? [
          {
            to: "/users",
            label: "إدارة المستخدمين والصلاحيات",
            description: "المستخدمون والأدوار — للمدير فقط",
            icon: ShieldCheck,
          },
        ]
      : []),
    { to: "/settings/system", label: "إعدادات النظام", description: "خيارات عامة للنظام", icon: Users },
  ];

  return (
    <div className="space-y-3">
      {sections.map(({ to, label, description, icon: Icon }) => (
        <button
          key={to}
          type="button"
          onClick={() => navigate({ to })}
          className="flex w-full items-center gap-3 rounded-2xl bg-card p-4 text-right shadow-sm transition-colors active:bg-accent"
        >
          <span className="flex h-11 w-11 shrink-0 items-center justify-center rounded-full bg-primary/10 text-primary">
            <Icon className="h-5 w-5" aria-hidden />
          </span>
          <span className="min-w-0 flex-1">
            <span className="block truncate text-sm font-bold text-foreground">{label}</span>
            <span className="block truncate text-xs text-muted-foreground">{description}</span>
          </span>
          <ChevronLeft className="h-5 w-5 shrink-0 text-muted-foreground" aria-hidden />
        </button>
      ))}
    </div>
  );
}
