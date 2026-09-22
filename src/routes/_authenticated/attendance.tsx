import { createFileRoute } from "@tanstack/react-router";
import { PlaceholderPage } from "@/components/placeholder-page";

export const Route = createFileRoute("/_authenticated/attendance")({
  ssr: false,
  head: () => ({
    meta: [
      { title: "الحضور والغياب | نظام الموارد البشرية" },
      { name: "description", content: "متابعة حضور وغياب الموظفين" },
      { property: "og:title", content: "الحضور والغياب | نظام الموارد البشرية" },
      { property: "og:description", content: "متابعة حضور وغياب الموظفين" },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary_large_image" },
    ],
  }),
  component: () => (
    <PlaceholderPage title="الحضور والغياب" description="سيتم تصميم شاشة الحضور والغياب هنا." />
  ),
});
