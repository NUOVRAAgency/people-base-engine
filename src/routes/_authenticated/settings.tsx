import { createFileRoute, Outlet, useNavigate, useRouterState } from "@tanstack/react-router";
import {
  Building2,
  ChevronLeft,
  CircleHelp,
  Globe,
  LoaderCircle,
  LogOut,
  Plus,
  ShieldCheck,
  SlidersHorizontal,
  Trash2,
  UserCog,
} from "lucide-react";
import { useEffect, useState } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { supabase } from "@/integrations/supabase/client";
import { ROLE_LABELS, useCurrentUser } from "@/hooks/use-current-user";
import { cn } from "@/lib/utils";

import { tr, trf } from "@/lib/i18n";
export const Route = createFileRoute("/_authenticated/settings")({
  head: () => ({
    meta: [
      { title: tr("الإعدادات | نظام الموارد البشرية") },
      { name: "description", content: tr("الملف الشخصي وإدارة المستخدمين والفروع وإعدادات النظام") },
      { property: "og:title", content: tr("الإعدادات | نظام الموارد البشرية") },
      { property: "og:description", content: tr("الملف الشخصي وإدارة المستخدمين والفروع وإعدادات النظام") },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary_large_image" },
    ],
  }),
  component: SettingsPage,
});

type Branch = { id: string; name: string; location: string | null; status: string };

function SettingsPage() {
  const navigate = useNavigate();
  const pathname = useRouterState({ select: (state) => state.location.pathname });
  const { role, isAdmin, loading } = useCurrentUser();
  const [branchesOpen, setBranchesOpen] = useState(false);
  const [language, setLanguage] = useState<"ar" | "en">("ar");
  const [helpOpen, setHelpOpen] = useState(false);

  if (pathname !== "/settings") return <Outlet />;

  const adminItems = [
    {
      key: "users",
      label: tr("إدارة المستخدمين والصلاحيات"),
      description: tr("المستخدمون والأدوار"),
      icon: ShieldCheck,
      action: () => navigate({ to: "/users" }),
    },
    {
      key: "system",
      label: tr("إعدادات النظام"),
      description: tr("اسم المنشأة ومواعيد الدوام"),
      icon: SlidersHorizontal,
      action: () => navigate({ to: "/settings/system" }),
    },
    {
      key: "branches",
      label: tr("إدارة الفروع"),
      description: tr("إضافة الفروع وتعديل حالتها"),
      icon: Building2,
      action: () => setBranchesOpen(true),
    },
  ];

  return (
    <div className="mx-auto w-full max-w-3xl space-y-4 pb-6">
      <section className="rounded-2xl border border-border/50 bg-card/75 p-5 shadow-glass backdrop-blur-sm">
        <div>
          <span className="inline-flex rounded-full bg-primary/10 px-3 py-1 text-xs font-medium text-primary">
            {loading ? tr("جاري التحميل") : role ? ROLE_LABELS[role] : tr("بدون دور")}
          </span>
        </div>
        <Button
          type="button"
          variant="outline"
          className="mt-4 h-11 w-full rounded-xl border-border/60 bg-background/50 text-sm font-medium"
          onClick={() => navigate({ to: "/account" })}
        >
          <UserCog className="h-4 w-4" aria-hidden />
          {tr("عرض الملف الشخصي")}
        </Button>
      </section>

      {isAdmin ? (
        <section className="space-y-2.5">
          <p className="px-1 text-xs font-medium text-muted-foreground">{tr("الإدارة والصلاحيات")}</p>
          <div className="overflow-hidden rounded-2xl border border-border/50 bg-card/75 shadow-glass backdrop-blur-sm">
            {adminItems.map(({ key, ...item }, index) => (
              <SettingsRow key={key} {...item} withBorderTop={index > 0} />
            ))}
          </div>
        </section>
      ) : null}

      <section className="space-y-2.5">
        <p className="px-1 text-xs font-medium text-muted-foreground">{tr("تفضيلات عامة")}</p>
        <div className="overflow-hidden rounded-2xl border border-border/50 bg-card/75 shadow-glass backdrop-blur-sm">
          <div className="flex items-center gap-3 px-4 py-3.5">
            <span className="flex size-10 shrink-0 items-center justify-center rounded-full bg-primary/10 text-primary">
              <Globe className="h-5 w-5" aria-hidden />
            </span>
            <span className="min-w-0 flex-1">
              <span className="block text-sm font-medium text-foreground">{tr("اللغة")}</span>
              <span className="block text-xs text-muted-foreground">{tr("لغة عرض الواجهة")}</span>
            </span>
            <span className="flex shrink-0 items-center gap-1 rounded-full border border-border/50 bg-background/60 p-1">
              {(["ar", "en"] as const).map((code) => (
                <button
                  key={code}
                  type="button"
                  onClick={() => setLanguage(code)}
                  className={cn(
                    "rounded-full px-3 py-1 text-[12px] font-medium transition-colors",
                    language === code ? "bg-primary text-primary-foreground" : "text-muted-foreground",
                  )}
                >
                  {code === "ar" ? tr("عربي") : "English"}
                </button>
              ))}
            </span>
          </div>

          <SettingsRow
            label={tr("مركز المساعدة")}
            description={tr("الاسئلة الشائعة والدعم")}
            icon={CircleHelp}
            action={() => setHelpOpen(true)}
            withBorderTop
          />
        </div>
      </section>

      <Button
        type="button"
        variant="outline"
        className="h-11 w-full rounded-xl border-destructive/25 bg-destructive/5 text-sm font-medium text-destructive hover:bg-destructive/10 hover:text-destructive"
        onClick={async () => {
          await supabase.auth.signOut();
          navigate({ to: "/auth", replace: true });
        }}
      >
        <LogOut className="h-4 w-4" aria-hidden />
        {tr("تسجيل الخروج")}
      </Button>

      <BranchesDialog open={branchesOpen} onOpenChange={setBranchesOpen} />

      <Dialog open={helpOpen} onOpenChange={setHelpOpen}>
        <DialogContent dir="rtl" className="max-w-md rounded-2xl border-border/50 bg-card/95 backdrop-blur-md">
          <DialogHeader className="text-start">
            <DialogTitle className="text-base font-semibold">{tr("مركز المساعدة")}</DialogTitle>
            <DialogDescription className="text-xs leading-[1.9]">
              {tr("دليل الاستخدام والدعم الفني قيد التجهيز، وسيتم تفعيله قريبا داخل التطبيق.")}
            </DialogDescription>
          </DialogHeader>
        </DialogContent>
      </Dialog>
    </div>
  );
}

function SettingsRow({
  label,
  description,
  icon: Icon,
  action,
  withBorderTop,
}: {
  label: string;
  description: string;
  icon: typeof UserCog;
  action: () => void;
  withBorderTop?: boolean;
}) {
  return (
    <button
      type="button"
      onClick={action}
      className={cn(
        "flex w-full items-center gap-3 px-4 py-3.5 text-start transition-colors hover:bg-muted/40 active:bg-muted/60",
        withBorderTop ? "border-t border-border/40" : "",
      )}
    >
      <span className="flex size-10 shrink-0 items-center justify-center rounded-full bg-primary/10 text-primary">
        <Icon className="h-5 w-5" aria-hidden />
      </span>
      <span className="min-w-0 flex-1">
        <span className="block truncate text-sm font-medium text-foreground">{label}</span>
        <span className="block truncate text-xs text-muted-foreground">{description}</span>
      </span>
      <ChevronLeft className="h-5 w-5 shrink-0 text-muted-foreground" aria-hidden />
    </button>
  );
}

function BranchesDialog({ open, onOpenChange }: { open: boolean; onOpenChange: (value: boolean) => void }) {
  const [branches, setBranches] = useState<Branch[]>([]);
  const [loading, setLoading] = useState(false);
  const [name, setName] = useState("");
  const [location, setLocation] = useState("");
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");

  useEffect(() => {
    if (!open) return;
    setLoading(true);
    void (async () => {
      const { data } = await supabase.from("branches").select("id,name,location,status").order("name");
      setBranches((data ?? []) as Branch[]);
      setLoading(false);
    })();
  }, [open]);

  async function addBranch() {
    if (name.trim().length < 2) {
      setError(tr("اكتب اسم الفرع"));
      return;
    }
    setSaving(true);
    setError("");
    const { data, error: insertError } = await supabase
      .from("branches")
      .insert({ name: name.trim(), location: location.trim() || null })
      .select("id,name,location,status")
      .single();
    setSaving(false);
    if (insertError || !data) {
      setError(tr("تعذر اضافة الفرع"));
      return;
    }
    setBranches((current) => [...current, data as Branch].sort((a, b) => a.name.localeCompare(b.name, "ar")));
    setName("");
    setLocation("");
  }

  async function toggleStatus(branch: Branch) {
    const next = branch.status === "active" ? "inactive" : "active";
    const { error: updateError } = await supabase.from("branches").update({ status: next }).eq("id", branch.id);
    if (updateError) {
      setError(tr("تعذر تحديث حالة الفرع"));
      return;
    }
    setBranches((current) => current.map((item) => (item.id === branch.id ? { ...item, status: next } : item)));
  }

  async function removeBranch(branch: Branch) {
    const { error: deleteError } = await supabase.from("branches").delete().eq("id", branch.id);
    if (deleteError) {
      setError(tr("تعذر حذف الفرع لوجود موظفين مرتبطين به"));
      return;
    }
    setBranches((current) => current.filter((item) => item.id !== branch.id));
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent dir="rtl" className="max-h-[88dvh] max-w-md overflow-y-auto rounded-2xl border-border/50 bg-card/95 backdrop-blur-md">
        <DialogHeader className="text-start">
          <DialogTitle className="text-base font-semibold">{tr("إدارة الفروع")}</DialogTitle>
          <DialogDescription className="text-xs">{tr("اضف الفروع وتحكم بتفعيلها او ايقافها")}</DialogDescription>
        </DialogHeader>

        <div className="space-y-2.5 rounded-xl border border-border/40 bg-background/40 p-3">
          <Input value={name} onChange={(event) => setName(event.target.value)} placeholder={tr("اسم الفرع")} className="h-11 rounded-xl" />
          <Input value={location} onChange={(event) => setLocation(event.target.value)} placeholder={tr("الموقع (اختياري)")} className="h-11 rounded-xl" />
          <Button type="button" className="h-11 w-full rounded-xl text-sm font-medium" disabled={saving} onClick={() => void addBranch()}>
            {saving ? <LoaderCircle className="h-4 w-4 animate-spin" aria-hidden /> : <Plus className="h-4 w-4" aria-hidden />}
            {tr("إضافة وحفظ")}
          </Button>
        </div>

        {error ? <p className="rounded-xl border border-destructive/25 bg-destructive/5 p-2.5 text-center text-xs text-destructive">{error}</p> : null}

        {loading ? (
          <p className="flex items-center justify-center gap-2 py-6 text-sm text-muted-foreground">
            <LoaderCircle className="h-4 w-4 animate-spin" aria-hidden />
            {tr("جاري تحميل الفروع")}
          </p>
        ) : !branches.length ? (
          <p className="py-6 text-center text-sm text-muted-foreground">{tr("لا توجد فروع بعد")}</p>
        ) : (
          <ul className="space-y-2">
            {branches.map((branch) => (
              <li key={branch.id} className="flex items-center gap-2 rounded-xl border border-border/40 bg-background/40 p-3">
                <span className="min-w-0 flex-1">
                  <span className="block truncate text-sm font-medium text-foreground">{branch.name}</span>
                  <span className="block truncate text-[11px] text-muted-foreground">{branch.location || tr("بدون موقع")}</span>
                </span>
                <button
                  type="button"
                  onClick={() => void toggleStatus(branch)}
                  className={cn(
                    "shrink-0 rounded-full px-2.5 py-1 text-[11px] font-medium transition-colors",
                    branch.status === "active" ? "bg-success/12 text-success" : "bg-muted text-muted-foreground",
                  )}
                >
                  {branch.status === "active" ? tr("نشط") : tr("موقوف")}
                </button>
                <Button
                  type="button"
                  variant="ghost"
                  size="icon"
                  aria-label={trf("حذف {0}", branch.name)}
                  className="size-9 shrink-0 rounded-full text-destructive hover:bg-destructive/10 hover:text-destructive"
                  onClick={() => void removeBranch(branch)}
                >
                  <Trash2 className="h-4 w-4" aria-hidden />
                </Button>
              </li>
            ))}
          </ul>
        )}
      </DialogContent>
    </Dialog>
  );
}
