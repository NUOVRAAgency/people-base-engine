import { createFileRoute } from "@tanstack/react-router";

export const Route = createFileRoute("/_authenticated/users")({
  head: () => ({
    meta: [
      { title: "المستخدمون | نظام الموارد البشرية" },
      { name: "description", content: "إدارة مستخدمي النظام وصلاحياتهم" },
      { property: "og:title", content: "المستخدمون | نظام الموارد البشرية" },
      { property: "og:description", content: "إدارة مستخدمي النظام وصلاحياتهم" },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary_large_image" },
    ],
  }),
  component: UsersPage,
});

function UsersPage() {
  return <div className="min-h-dvh bg-white" dir="rtl" />;
}
