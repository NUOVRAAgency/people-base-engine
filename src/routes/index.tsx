import { createFileRoute } from "@tanstack/react-router";

export const Route = createFileRoute("/")({
  head: () => ({
    meta: [
      { title: "HR System" },
      { name: "description", content: "نظام إدارة الموارد البشرية" },
      { property: "og:title", content: "HR System" },
      { property: "og:description", content: "نظام إدارة الموارد البشرية" },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary_large_image" },
    ],
  }),
  component: Index,
});

function Index() {
  return <div className="min-h-screen bg-white" />;
}
