import { createFileRoute } from "@tanstack/react-router";

export const Route = createFileRoute("/_authenticated/leaves")({
  head: () => ({
    meta: [
      { title: "الإجازات | نظام الموارد البشرية" },
      { name: "description", content: "طلبات الإجازات والموافقات" },
      { property: "og:title", content: "الإجازات | نظام الموارد البشرية" },
      { property: "og:description", content: "طلبات الإجازات والموافقات" },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary_large_image" },
    ],
  }),
  component: LeavesPage,
});

function LeavesPage() {
  return <div className="space-y-4" />;
}
