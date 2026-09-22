import { createFileRoute } from "@tanstack/react-router";

export const Route = createFileRoute("/_authenticated/reports")({
  head: () => ({
    meta: [
      { title: "التقارير | نظام الموارد البشرية" },
      { name: "description", content: "تقارير الموظفين والحضور والرواتب" },
      { property: "og:title", content: "التقارير | نظام الموارد البشرية" },
      { property: "og:description", content: "تقارير الموظفين والحضور والرواتب" },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary_large_image" },
    ],
  }),
  component: ReportsPage,
});

function ReportsPage() {
  return <div className="space-y-4" />;
}
