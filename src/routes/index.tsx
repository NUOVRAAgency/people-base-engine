import { createFileRoute } from "@tanstack/react-router";

import { tr, trf } from "@/lib/i18n";
export const Route = createFileRoute("/")({
  head: () => ({ meta: [{ title: tr("نظام الموارد البشرية الذكي") }, { name: "description", content: tr("نظام إدارة الموارد البشرية") }, { property: "og:title", content: tr("نظام الموارد البشرية الذكي") }, { property: "og:description", content: tr("نظام إدارة الموارد البشرية") }, { property: "og:type", content: "website" }, { name: "twitter:card", content: "summary_large_image" }] }),
  component: Index,
});

function Index() {
  return <main className="min-h-dvh bg-white" />;
}
