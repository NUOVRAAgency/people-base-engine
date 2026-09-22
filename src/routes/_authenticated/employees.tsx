import { createFileRoute } from "@tanstack/react-router";
import { PlaceholderPage } from "@/components/placeholder-page";

export const Route = createFileRoute("/_authenticated/employees")({
  ssr: false,
  head: () => ({
    meta: [
      { title: "الموظفون | نظام الموارد البشرية" },
      { name: "description", content: "قائمة الموظفين وبياناتهم" },
      { property: "og:title", content: "الموظفون | نظام الموارد البشرية" },
      { property: "og:description", content: "قائمة الموظفين وبياناتهم" },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary_large_image" },
    ],
  }),
  component: () => (
    <PlaceholderPage title="الموظفون" description="سيتم تصميم شاشة إدارة الموظفين هنا." />
  ),
});
