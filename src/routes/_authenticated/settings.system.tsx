import { createFileRoute } from "@tanstack/react-router";

export const Route = createFileRoute("/_authenticated/settings/system")({
  head: () => ({
    meta: [
      { title: "إعدادات النظام | نظام الموارد البشرية" },
      { name: "description", content: "الخيارات العامة لنظام الموارد البشرية" },
      { property: "og:title", content: "إعدادات النظام | نظام الموارد البشرية" },
      { property: "og:description", content: "الخيارات العامة لنظام الموارد البشرية" },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary_large_image" },
    ],
  }),
  component: SystemSettingsPage,
});

function SystemSettingsPage() {
  return <div className="space-y-4" />;
}
