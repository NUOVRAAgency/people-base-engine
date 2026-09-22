import { createFileRoute } from "@tanstack/react-router";

export const Route = createFileRoute("/_authenticated/settings")({
  head: () => ({
    meta: [
      { title: "الإعدادات | نظام الموارد البشرية" },
      { name: "description", content: "إعدادات النظام" },
      { property: "og:title", content: "الإعدادات | نظام الموارد البشرية" },
      { property: "og:description", content: "إعدادات النظام" },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary_large_image" },
    ],
  }),
  component: SettingsPage,
});

function SettingsPage() {
  return <div className="min-h-dvh bg-white" dir="rtl" />;
}
