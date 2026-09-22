import { createFileRoute } from "@tanstack/react-router";

export const Route = createFileRoute("/_authenticated/users")({
  head: () => ({ meta: [{ title: "المساعد الذكي | نظام الموارد البشرية" }, { name: "description", content: "مساعد الموارد البشرية" }, { property: "og:title", content: "المساعد الذكي | نظام الموارد البشرية" }, { property: "og:description", content: "مساعد الموارد البشرية" }, { property: "og:type", content: "website" }, { name: "twitter:card", content: "summary_large_image" }] }),
  component: AssistantPage,
});

function AssistantPage() {
  return <main className="min-h-dvh bg-white" />;
}
