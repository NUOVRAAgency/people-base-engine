import { createFileRoute } from "@tanstack/react-router";
import { PlaceholderPage } from "@/components/placeholder-page";

export const Route = createFileRoute("/_authenticated/users")({
  ssr: false,
  head: () => ({
    meta: [
      { title: "إدارة المستخدمين والصلاحيات | نظام الموارد البشرية" },
      { name: "description", content: "إدارة المستخدمين وأدوارهم" },
      { property: "og:title", content: "إدارة المستخدمين والصلاحيات" },
      { property: "og:description", content: "إدارة المستخدمين وأدوارهم" },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary_large_image" },
    ],
  }),
  component: () => (
    <PlaceholderPage
      title="إدارة المستخدمين والصلاحيات"
      description="سيتم تصميم شاشة المستخدمين والصلاحيات هنا."
    />
  ),
});
