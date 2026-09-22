import { createFileRoute } from "@tanstack/react-router";
import { PlaceholderPage } from "@/components/placeholder-page";

export const Route = createFileRoute("/_authenticated/payroll")({
  ssr: false,
  head: () => ({
    meta: [
      { title: "الرواتب | نظام الموارد البشرية" },
      { name: "description", content: "كشوفات رواتب الموظفين" },
      { property: "og:title", content: "الرواتب | نظام الموارد البشرية" },
      { property: "og:description", content: "كشوفات رواتب الموظفين" },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary_large_image" },
    ],
  }),
  component: () => (
    <PlaceholderPage title="الرواتب" description="سيتم تصميم شاشة الرواتب هنا." />
  ),
});
