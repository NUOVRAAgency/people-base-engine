import { createFileRoute } from "@tanstack/react-router";
import { PlaceholderPage } from "@/components/placeholder-page";

export const Route = createFileRoute("/_authenticated/settings")({
  ssr: false,
  head: () => ({
    meta: [
      { title: "الإعدادات | نظام الموارد البشرية" },
      { name: "description", content: "إعدادات النظام العامة" },
      { property: "og:title", content: "الإعدادات | نظام الموارد البشرية" },
      { property: "og:description", content: "إعدادات النظام العامة" },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary_large_image" },
    ],
  }),
  component: () => (
    <PlaceholderPage title="الإعدادات" description="سيتم تصميم شاشة الإعدادات هنا." />
  ),
});
