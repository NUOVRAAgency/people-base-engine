import { createFileRoute } from "@tanstack/react-router";

export const Route = createFileRoute("/_authenticated/dashboard")({
  head: () => ({ meta: [{ title: "الرئيسية | نظام الموارد البشرية" }, { name: "description", content: "الرئيسية في نظام الموارد البشرية" }, { property: "og:title", content: "الرئيسية | نظام الموارد البشرية" }, { property: "og:description", content: "الرئيسية في نظام الموارد البشرية" }, { property: "og:type", content: "website" }, { name: "twitter:card", content: "summary_large_image" }] }),
  component: DashboardPage,
});

function DashboardPage() {
  return <main className="min-h-dvh bg-white" />;
}
