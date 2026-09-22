import { createFileRoute } from "@tanstack/react-router";
import { ImageUp } from "lucide-react";
import { useRef, useState } from "react";
import { Button } from "@/components/ui/button";
import { supabase } from "@/integrations/supabase/client";
import { useCurrentUser } from "@/hooks/use-current-user";

export const Route = createFileRoute("/_authenticated/settings/system")({
  head: () => ({ meta: [{ title: "إعدادات النظام | نظام الموارد البشرية" }, { name: "description", content: "الخيارات العامة لنظام الموارد البشرية" }, { property: "og:title", content: "إعدادات النظام | نظام الموارد البشرية" }, { property: "og:description", content: "الخيارات العامة لنظام الموارد البشرية" }, { property: "og:type", content: "website" }, { name: "twitter:card", content: "summary_large_image" }] }),
  component: SystemSettingsPage,
});

function SystemSettingsPage() {
  const { isAdmin } = useCurrentUser();
  const inputRef = useRef<HTMLInputElement>(null);
  const [uploading, setUploading] = useState(false);

  async function uploadLogo(file: File) {
    if (!file.type.startsWith("image/") || !isAdmin) return;
    setUploading(true);
    const { data } = await supabase.auth.getUser();
    const extension = file.name.split(".").pop()?.toLowerCase() || "png";
    const path = `organization/logo.${extension}`;
    const { error } = await supabase.storage.from("hr-branding").upload(path, file, { upsert: true, contentType: file.type });
    if (!error) {
      await supabase.from("app_settings").update({ logo_path: path, updated_by: data.user?.id ?? null }).eq("id", "organization");
      window.dispatchEvent(new Event("hr-header-refresh"));
    }
    setUploading(false);
  }

  if (!isAdmin) return <p className="py-8 text-center text-sm text-muted-foreground">إعدادات الشعار متاحة لمدير النظام فقط</p>;

  return (
    <section className="rounded-lg bg-card p-5 shadow-sm">
      <h2 className="text-base font-bold text-foreground">شعار المؤسسة</h2>
      <p className="mt-1 text-sm leading-6 text-muted-foreground">ارفع صورة مربعة واضحة لتظهر تلقائياً بجانب عنوان كل قسم.</p>
      <input ref={inputRef} type="file" accept="image/*" className="hidden" onChange={(event) => { const file = event.target.files?.[0]; if (file) void uploadLogo(file); event.target.value = ""; }} />
      <Button type="button" className="mt-4 w-full" disabled={uploading} onClick={() => inputRef.current?.click()}>
        <ImageUp aria-hidden /> {uploading ? "جارٍ رفع الشعار..." : "رفع شعار المؤسسة"}
      </Button>
    </section>
  );
}
