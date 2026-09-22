import { createFileRoute } from "@tanstack/react-router";

export const Route = createFileRoute("/_authenticated/attendance")({
  head: () => ({
    meta: [
      { title: "الحضور | نظام الموارد البشرية" },
      { name: "description", content: "متابعة حضور وغياب الموظفين" },
      { property: "og:title", content: "الحضور | نظام الموارد البشرية" },
      { property: "og:description", content: "متابعة حضور وغياب الموظفين" },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary_large_image" },
    ],
  }),
  component: AttendancePage,
});

function AttendancePage() {
  return <div className="min-h-dvh bg-white" dir="rtl" />;
}
