import { createFileRoute } from "@tanstack/react-router";

export const Route = createFileRoute("/_authenticated/dashboard")({
  head: () => ({
    meta: [
      { title: "لوحة التحكم | HR System" },
      { name: "description", content: "لوحة تحكم نظام إدارة الموارد البشرية" },
      { property: "og:title", content: "لوحة التحكم | HR System" },
      { property: "og:description", content: "لوحة تحكم نظام إدارة الموارد البشرية" },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary_large_image" },
    ],
  }),
  component: Dashboard,
});

function Dashboard() {
  return <div />;
}
