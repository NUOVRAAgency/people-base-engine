import { createFileRoute } from "@tanstack/react-router";

export const Route = createFileRoute("/_authenticated/payroll")({
  head: () => ({ meta: [{ title: "الرواتب | نظام الموارد البشرية" }, { name: "description", content: "إدارة الرواتب" }, { property: "og:title", content: "الرواتب | نظام الموارد البشرية" }, { property: "og:description", content: "إدارة الرواتب" }, { property: "og:type", content: "website" }, { name: "twitter:card", content: "summary_large_image" }] }),
  component: PayrollPage,
});

function PayrollPage() {
  return <main className="min-h-dvh bg-white" />;
}
