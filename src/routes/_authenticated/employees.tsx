import { createFileRoute } from "@tanstack/react-router";

export const Route = createFileRoute("/_authenticated/employees")({
  head: () => ({
    meta: [
      { title: "الموظفون | نظام الموارد البشرية" },
      { name: "description", content: "إدارة بيانات الموظفين" },
      { property: "og:title", content: "الموظفون | نظام الموارد البشرية" },
      { property: "og:description", content: "إدارة بيانات الموظفين" },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary_large_image" },
    ],
  }),
  component: EmployeesPage,
});

function EmployeesPage() {
  return <div className="min-h-dvh bg-white" dir="rtl" />;
}
