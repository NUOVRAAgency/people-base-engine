import { createFileRoute } from "@tanstack/react-router";

export const Route = createFileRoute("/")({
  head: () => ({ meta: [{ title: "نظام الموارد البشرية الذكي" }, { name: "description", content: "نظام إدارة الموارد البشرية" }, { property: "og:title", content: "نظام الموارد البشرية الذكي" }, { property: "og:description", content: "نظام إدارة الموارد البشرية" }, { property: "og:type", content: "website" }, { name: "twitter:card", content: "summary_large_image" }] }),
  component: Index,
});

function Index() {
  return <main className="min-h-dvh bg-white" />;
}
