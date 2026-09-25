import { createFileRoute } from "@tanstack/react-router";

import { tr, trf } from "@/lib/i18n";
export const Route = createFileRoute("/_authenticated/users")({
  head: () => ({ meta: [{ title: tr("المساعد الذكي | نظام الموارد البشرية") }, { name: "description", content: tr("مساعد الموارد البشرية") }, { property: "og:title", content: tr("المساعد الذكي | نظام الموارد البشرية") }, { property: "og:description", content: tr("مساعد الموارد البشرية") }, { property: "og:type", content: "website" }, { name: "twitter:card", content: "summary_large_image" }] }),
  component: AssistantPage,
});

function AssistantPage() {
  return <main className="min-h-dvh bg-white" />;
}
