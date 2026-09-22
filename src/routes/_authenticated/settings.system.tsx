import { createFileRoute } from "@tanstack/react-router";
import { Building2, Save } from "lucide-react";
import { useEffect, useState } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { supabase } from "@/integrations/supabase/client";
import { useCurrentUser } from "@/hooks/use-current-user";

export const Route = createFileRoute("/_authenticated/settings/system")({
  head: () => ({ meta: [{ title: "إعدادات النظام | نظام الموارد البشرية" }, { name: "description", content: "الخيارات العامة لنظام الموارد البشرية" }, { property: "og:title", content: "إعدادات النظام | نظام الموارد البشرية" }, { property: "og:description", content: "الخيارات العامة لنظام الموارد البشرية" }, { property: "og:type", content: "website" }, { name: "twitter:card", content: "summary_large_image" }] }),
  component: SystemSettingsPage,
});

function SystemSettingsPage() {
  const { isAdmin } = useCurrentUser();
  const [companyName, setCompanyName] = useState("");
  const [saving, setSaving] = useState(false);
  const [saved, setSaved] = useState(false);

  useEffect(() => {
    if (!isAdmin) return;
    void supabase
      .from("app_settings")
      .select("company_name")
      .eq("id", "organization")
      .maybeSingle()
      .then(({ data }) => setCompanyName(data?.company_name ?? ""));
  }, [isAdmin]);

  async function saveCompanyName() {
    if (!isAdmin) return;
    setSaving(true);
    setSaved(false);
    const { data } = await supabase.auth.getUser();
    const { error } = await supabase.from("app_settings").update({ company_name: companyName.trim() || null, updated_by: data.user?.id ?? null }).eq("id", "organization");
    if (!error) {
      window.dispatchEvent(new Event("hr-header-refresh"));
      setSaved(true);
    }
    setSaving(false);
  }

  if (!isAdmin) return <p className="py-8 text-center text-sm text-muted-foreground">إعدادات الشركة متاحة لمدير النظام فقط</p>;

  return (
    <section className="rounded-lg bg-card p-5 shadow-sm">
      <div className="flex items-center gap-2">
        <Building2 className="h-5 w-5 text-primary" aria-hidden />
        <h2 className="text-base font-bold text-foreground">اسم الشركة</h2>
      </div>
      <p className="mt-1 text-sm leading-6 text-muted-foreground">يظهر الاسم في منتصف الهيدر، ويختفي تماماً عند ترك الحقل فارغاً.</p>
      <Input dir="auto" value={companyName} onChange={(event) => { setCompanyName(event.target.value); setSaved(false); }} maxLength={50} placeholder="اكتب اسم الشركة" className="mt-4 h-11" />
      <Button type="button" className="mt-3 w-full" disabled={saving} onClick={() => void saveCompanyName()}>
        <Save aria-hidden /> {saving ? "جارٍ الحفظ..." : saved ? "تم الحفظ" : "حفظ اسم الشركة"}
      </Button>
    </section>
  );
}
