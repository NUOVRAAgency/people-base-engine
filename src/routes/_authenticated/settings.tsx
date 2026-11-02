import { signOutAndClear } from "@/lib/offline";
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

import { tr, trf, getLanguage, setLanguage } from "@/lib/i18n";
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

type Branch = { id: string; name: string; location: string | null; status: string; address: string | null; manager_employee_id: string | null };
type BranchEmployee = { id: string; full_name: string; branch_id: string | null };

const FAQ: { q: string; a: string }[] = [
  { q: "كيف أضيف موظفاً؟", a: "من قسم الموظفين اضغط «إضافة موظف»، املأ البيانات الأساسية والوظيفية ثم احفظ. رقم الموظف يُولّد تلقائياً." },
  { q: "كيف أسجّل الحضور؟", a: "من قسم الحضور اضغط على بطاقة الموظف أو «تسجيل حضور يدوي»، اختر الحالة ووقت الدخول والخروج. التأخير يُحسب من مواعيد الدوام." },
  { q: "كيف أقدّم طلب إجازة؟", a: "من قسم الإجازات أنشئ طلباً جديداً بنوع الإجازة وتاريخيها. يعتمده مدير النظام أو يرفضه." },
  { q: "كيف أولّد الرواتب؟", a: "من قسم الرواتب اختر الشهر واضغط «توليد المسير»، راجع المؤثرات والسلف، ثم اعتمد المسير لتسجيل الصرف." },
  { q: "كيف أصدّر التقارير؟", a: "من قسم التقارير اختر الشهر ونوع التقرير ثم اضغط تصدير لتنزيل ملف CSV." },
  { q: "ما هو قرار الغياب؟", a: "الغياب بلا إجازة معتمدة يُخصم تلقائياً بقيمة يوم. من تبويب «الغياب» في الحضور يقرر المدير: خصم، أو إعفاء يعيد قيمة اليوم في القسيمة، أو إعادة إلى قيد المراجعة. لا يمكن التغيير بعد اعتماد راتب الشهر." },
];

function SettingsPage() {
  const navigate = useNavigate();
  const pathname = useRouterState({ select: (state) => state.location.pathname });
  const { role, isAdmin, loading } = useCurrentUser();
  const [branchesOpen, setBranchesOpen] = useState(false);
  const language = getLanguage();
  const [helpOpen, setHelpOpen] = useState(false);

  if (pathname !== "/settings") return <Outlet />;

  const adminItems = [
    {
      key: "journal",
      label: tr("القيود اليومية"),
      description: tr("قيود الرواتب المرحّلة وتصديرها"),
      icon: ShieldCheck,
      action: () => navigate({ to: "/journal" }),
    },
    {
      key: "fingerprint",
      label: tr("استيراد البصمة"),
      description: tr("ملفات ZKTeco وتصحيح الحركات"),
      icon: ShieldCheck,
      action: () => navigate({ to: "/fingerprint-import" }),
    },
    {
      key: "financials",
      label: tr("القوائم المالية"),
      description: tr("ميزان المراجعة وقائمة الدخل والميزانية"),
      icon: ShieldCheck,
      action: () => navigate({ to: "/financials" }),
    },
    {
      key: "vouchers",
      label: tr("سندات الصرف"),
      description: tr("صرف الرواتب والسلف والمصروفات بقيودها"),
      icon: ShieldCheck,
      action: () => navigate({ to: "/vouchers" }),
    },
    {
      key: "accounts",
      label: tr("دليل الحسابات"),
      description: tr("الحسابات ومراكز التكلفة والصناديق والبنوك"),
      icon: ShieldCheck,
      action: () => navigate({ to: "/accounts" }),
    },
    {
      key: "shifts",
      label: tr("الورديات ومواعيد العمل"),
      description: tr("تعريف الورديات وربط الموظفين بها"),
      icon: ShieldCheck,
      action: () => navigate({ to: "/shifts" }),
    },
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
                  onClick={() => { if (code !== language) setLanguage(code); }}
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
          await signOutAndClear();
          navigate({ to: "/auth", replace: true });
        }}
      >
        <LogOut className="h-4 w-4" aria-hidden />
        {tr("تسجيل الخروج")}
      </Button>

      <BranchesDialog open={branchesOpen} onOpenChange={setBranchesOpen} />

      <Dialog open={helpOpen} onOpenChange={setHelpOpen}>
        <DialogContent className="max-w-md rounded-2xl border-border/50 bg-card/95 backdrop-blur-md">
          <DialogHeader className="text-start">
            <DialogTitle className="text-base font-semibold">{tr("مركز المساعدة")}</DialogTitle>
            <DialogDescription className="text-xs leading-[1.9]">{tr("الاسئلة الشائعة")}</DialogDescription>
          </DialogHeader>
          <div className="max-h-[65dvh] space-y-2 overflow-y-auto">
            {FAQ.map((item) => (
              <details key={item.q} className="group rounded-xl border border-border/40 bg-background/40 px-3 py-2.5">
                <summary className="flex cursor-pointer list-none items-center justify-between gap-2 text-sm font-medium text-foreground">
                  {tr(item.q)}
                  <ChevronLeft className="h-4 w-4 shrink-0 text-muted-foreground transition-transform group-open:-rotate-90" aria-hidden />
                </summary>
                <p className="pt-2 text-xs leading-[1.9] text-muted-foreground">{tr(item.a)}</p>
              </details>
            ))}
          </div>
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
  const [address, setAddress] = useState("");
  const [staff, setStaff] = useState<BranchEmployee[]>([]);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");

  useEffect(() => {
    if (!open) return;
    setLoading(true);
    void (async () => {
      const [{ data }, { data: emp }] = await Promise.all([
        supabase.from("branches").select("id,name,location,status,address,manager_employee_id").order("name"),
        supabase.from("employees").select("id,full_name,branch_id").eq("status", "active").order("full_name"),
      ]);
      setBranches((data ?? []) as Branch[]);
      setStaff((emp ?? []) as BranchEmployee[]);
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
      .insert({ name: name.trim(), location: location.trim() || null, address: address.trim() || null })
      .select("id,name,location,status,address,manager_employee_id")
      .single();
    setSaving(false);
    if (insertError || !data) {
      setError(tr("تعذر اضافة الفرع"));
      return;
    }
    setBranches((current) => [...current, data as Branch].sort((a, b) => a.name.localeCompare(b.name, "ar")));
    setName("");
    setLocation("");
    setAddress("");
  }

  async function updateBranch(branch: Branch, patch: Partial<Pick<Branch, "address" | "manager_employee_id">>) {
    setError("");
    const { error: updateError } = await supabase.from("branches").update(patch).eq("id", branch.id);
    if (updateError) {
      setError(tr("تعذر حفظ بيانات الفرع"));
      return;
    }
    setBranches((current) => current.map((item) => (item.id === branch.id ? { ...item, ...patch } : item)));
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
      <DialogContent className="max-h-[88dvh] max-w-md overflow-y-auto rounded-2xl border-border/50 bg-card/95 backdrop-blur-md">
        <DialogHeader className="text-start">
          <DialogTitle className="text-base font-semibold">{tr("إدارة الفروع")}</DialogTitle>
          <DialogDescription className="text-xs">{tr("اضف الفروع وتحكم بتفعيلها او ايقافها")}</DialogDescription>
        </DialogHeader>

        <div className="space-y-2.5 rounded-xl border border-border/40 bg-background/40 p-3">
          <Input value={name} onChange={(event) => setName(event.target.value)} placeholder={tr("اسم الفرع")} className="h-11 rounded-xl" />
          <Input value={location} onChange={(event) => setLocation(event.target.value)} placeholder={tr("الموقع (اختياري)")} className="h-11 rounded-xl" />
          <Input value={address} onChange={(event) => setAddress(event.target.value)} placeholder={tr("العنوان (اختياري)")} className="h-11 rounded-xl" />
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
              <li key={branch.id} className="space-y-2 rounded-xl border border-border/40 bg-background/40 p-3">
               <div className="flex items-center gap-2">
                <span className="min-w-0 flex-1">
                  <span className="block truncate text-sm font-medium text-foreground">{branch.name}</span>
                  <span className="block truncate text-[11px] text-muted-foreground">
                    {branch.location || tr("بدون موقع")} · {trf("{0} موظف", staff.filter((e) => e.branch_id === branch.id).length)}
                  </span>
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
               </div>
                <Input
                  key={`${branch.id}-${branch.address ?? ""}`}
                  defaultValue={branch.address ?? ""}
                  placeholder={tr("العنوان")}
                  className="h-10 rounded-xl text-xs"
                  onBlur={(event) => {
                    const value = event.target.value.trim() || null;
                    if (value !== branch.address) void updateBranch(branch, { address: value });
                  }}
                />
                <select
                  value={branch.manager_employee_id ?? ""}
                  onChange={(event) => void updateBranch(branch, { manager_employee_id: event.target.value || null })}
                  className="h-10 w-full rounded-xl border border-input bg-background px-3 text-xs"
                  aria-label={tr("مدير الفرع")}
                >
                  <option value="">{tr("بدون مدير فرع")}</option>
                  {staff.filter((e) => e.branch_id === branch.id).map((e) => (
                    <option key={e.id} value={e.id}>{e.full_name}</option>
                  ))}
                </select>
              </li>
            ))}
          </ul>
        )}
      </DialogContent>
    </Dialog>
  );
}
