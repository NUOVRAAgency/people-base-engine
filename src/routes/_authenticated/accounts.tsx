import { createFileRoute } from "@tanstack/react-router";
import { BookOpen, LoaderCircle, Plus } from "lucide-react";
import { useCallback, useEffect, useState } from "react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { useCurrentUser } from "@/hooks/use-current-user";
import { supabase } from "@/integrations/supabase/client";
import { tr, accName } from "@/lib/i18n";

export const Route = createFileRoute("/_authenticated/accounts")({
  head: () => ({
    meta: [
      { title: tr("دليل الحسابات | نظام الموارد البشرية") },
      { name: "description", content: tr("دليل الحسابات ومراكز التكلفة والصناديق والبنوك") },
      { property: "og:title", content: tr("دليل الحسابات | نظام الموارد البشرية") },
      { property: "og:description", content: tr("دليل الحسابات ومراكز التكلفة والصناديق والبنوك") },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary_large_image" },
    ],
  }),
  component: AccountsPage,
});

type Account = { id: string; code: string; name_ar: string; name_en?: string | null; account_type: string; normal_side: string; parent_id: string | null; is_parent: boolean };
type Center = { id: string; code: string; name: string; branches: { name: string } | null };
type Cash = { id: string; name: string; kind: string; bank_account_number: string | null; chart_of_accounts: { code: string; name_ar: string; name_en?: string | null } | null };

const sel = "h-10 w-full rounded-xl border border-input bg-background px-3 text-sm";
const TYPES: Record<string, string> = { asset: "أصول", liability: "خصوم", equity: "حقوق ملكية", revenue: "إيرادات", expense: "مصروفات" };
const card = "space-y-3 rounded-2xl border border-border/50 bg-card p-5 shadow-glass";

function AccountsPage() {
  const { isAdmin, loading } = useCurrentUser();
  const [tab, setTab] = useState<"coa" | "cc" | "cash">("coa");
  const [accounts, setAccounts] = useState<Account[]>([]);
  const [centers, setCenters] = useState<Center[]>([]);
  const [cash, setCash] = useState<Cash[]>([]);
  const [branches, setBranches] = useState<{ id: string; name: string }[]>([]);
  const [acc, setAcc] = useState({ code: "", name_ar: "", name_en: "", parent_id: "" });
  const [cc, setCc] = useState({ code: "", name: "", branch_id: "" });
  const [cb, setCb] = useState({ name: "", kind: "cash", account_id: "", bank_account_number: "" });

  const load = useCallback(async () => {
    const [a, c, k, b] = await Promise.all([
      supabase.from("chart_of_accounts").select("id,code,name_ar,name_en,account_type,normal_side,parent_id,is_parent").order("code"),
      supabase.from("cost_centers").select("id,code,name,branches(name)").order("code"),
      supabase.from("cash_and_banks").select("id,name,kind,bank_account_number,chart_of_accounts(code,name_ar,name_en)"),
      supabase.from("branches").select("id,name"),
    ]);
    setAccounts((a.data ?? []) as Account[]);
    setCenters((c.data ?? []) as unknown as Center[]);
    setCash((k.data ?? []) as unknown as Cash[]);
    setBranches(b.data ?? []);
  }, []);
  useEffect(() => { if (isAdmin) void load(); }, [isAdmin, load]);

  const done = (error: { message: string; code?: string } | null) => { if (error) toast.error(error.code === "23505" ? tr("هذا الرمز أو الاسم مستخدم مسبقاً") : tr("تعذر الحفظ، تحقق من البيانات والصلاحيات")); else { toast.success(tr("تم الحفظ")); void load(); } return !error; };

  async function addAccount() {
    const parent = accounts.find((x) => x.id === acc.parent_id);
    if (!parent || !acc.code.trim() || !acc.name_ar.trim()) { toast.error(tr("أكمل الحقول المطلوبة")); return; }
    const { error } = await supabase.from("chart_of_accounts").insert({ code: acc.code.trim(), name_ar: acc.name_ar.trim(), name_en: acc.name_en.trim() || null, parent_id: parent.id, account_type: parent.account_type, normal_side: parent.normal_side, is_parent: false });
    if (done(error)) setAcc({ code: "", name_ar: "", name_en: "", parent_id: "" });
  }
  async function addCenter() {
    if (!cc.code.trim() || !cc.name.trim()) { toast.error(tr("أكمل الحقول المطلوبة")); return; }
    const { error } = await supabase.from("cost_centers").insert({ code: cc.code.trim(), name: cc.name.trim(), branch_id: cc.branch_id || null });
    if (done(error)) setCc({ code: "", name: "", branch_id: "" });
  }
  async function addCash() {
    if (!cb.name.trim() || !cb.account_id) { toast.error(tr("أكمل الحقول المطلوبة")); return; }
    const { error } = await supabase.from("cash_and_banks").insert({ name: cb.name.trim(), kind: cb.kind, account_id: cb.account_id, bank_account_number: cb.bank_account_number || null });
    if (done(error)) setCb({ name: "", kind: "cash", account_id: "", bank_account_number: "" });
  }

  if (loading) return <LoaderCircle className="mx-auto mt-10 animate-spin text-primary" />;
  if (!isAdmin) return <p className="p-6 text-center text-muted-foreground">{tr("هذه الصفحة للمدير فقط")}</p>;

  const parents = accounts.filter((a) => a.is_parent);
  const assetLeaves = accounts.filter((a) => !a.is_parent && a.account_type === "asset");
  const depth = (a: Account) => { let d = 0; let p = a.parent_id; while (p && d < 6) { d++; p = accounts.find((x) => x.id === p)?.parent_id ?? null; } return d; };

  return (
    <div className="mx-auto w-full max-w-4xl space-y-4 pb-6">
      <div className="flex gap-2 overflow-x-auto">
        {([["coa", "دليل الحسابات"], ["cc", "مراكز التكلفة"], ["cash", "الصناديق والبنوك"]] as const).map(([k, l]) => (
          <Button key={k} variant={tab === k ? "default" : "outline"} size="sm" onClick={() => setTab(k)}>{tr(l)}</Button>
        ))}
      </div>

      {tab === "coa" && (<>
        <section className={card}>
          <h2 className="flex items-center gap-2 font-bold"><Plus className="size-4 text-primary" />{tr("إضافة حساب فرعي")}</h2>
          <div className="grid gap-3 sm:grid-cols-4">
            <select className={sel} value={acc.parent_id} onChange={(e) => setAcc({ ...acc, parent_id: e.target.value })}><option value="">{tr("الحساب الرئيسي")}</option>{parents.map((p) => <option key={p.id} value={p.id}>{p.code} - {accName(p)}</option>)}</select>
            <Input placeholder={tr("رقم الحساب")} value={acc.code} onChange={(e) => setAcc({ ...acc, code: e.target.value })} />
            <Input placeholder={tr("اسم الحساب")} value={acc.name_ar} onChange={(e) => setAcc({ ...acc, name_ar: e.target.value })} />
            <Input dir="ltr" placeholder={tr("اسم الحساب بالإنجليزية")} value={acc.name_en} onChange={(e) => setAcc({ ...acc, name_en: e.target.value })} />
          </div>
          <Button size="sm" onClick={addAccount}>{tr("إضافة")}</Button>
        </section>
        <section className={card}>
          <h2 className="flex items-center gap-2 font-bold"><BookOpen className="size-4 text-primary" />{tr("شجرة الحسابات")}</h2>
          <div className="divide-y divide-border/50 text-sm">
            {accounts.map((a) => (
              <div key={a.id} className="flex items-center justify-between py-2" style={{ paddingInlineStart: depth(a) * 18 }}>
                <span className={a.is_parent ? "font-bold" : ""}>{a.code} — {accName(a)}</span>
                <span className="text-xs text-muted-foreground">{tr(TYPES[a.account_type] ?? a.account_type)} · {a.normal_side === "debit" ? tr("مدين") : tr("دائن")}</span>
              </div>
            ))}
          </div>
        </section>
      </>)}

      {tab === "cc" && (
        <section className={card}>
          <h2 className="font-bold">{tr("مراكز التكلفة")}</h2>
          <div className="grid gap-3 sm:grid-cols-3">
            <Input placeholder={tr("الرمز")} value={cc.code} onChange={(e) => setCc({ ...cc, code: e.target.value })} />
            <Input placeholder={tr("الاسم")} value={cc.name} onChange={(e) => setCc({ ...cc, name: e.target.value })} />
            <select className={sel} value={cc.branch_id} onChange={(e) => setCc({ ...cc, branch_id: e.target.value })}><option value="">{tr("كل الفروع")}</option>{branches.map((b) => <option key={b.id} value={b.id}>{b.name}</option>)}</select>
          </div>
          <Button size="sm" onClick={addCenter}>{tr("إضافة")}</Button>
          <div className="divide-y divide-border/50 text-sm">{centers.length ? centers.map((c) => <div key={c.id} className="flex justify-between py-2"><span>{c.code} — {c.name}</span><span className="text-muted-foreground">{c.branches?.name ?? tr("كل الفروع")}</span></div>) : <p className="text-muted-foreground">{tr("لا توجد مراكز تكلفة بعد")}</p>}</div>
        </section>
      )}

      {tab === "cash" && (
        <section className={card}>
          <h2 className="font-bold">{tr("الصناديق والبنوك")}</h2>
          <div className="grid gap-3 sm:grid-cols-2">
            <Input placeholder={tr("الاسم")} value={cb.name} onChange={(e) => setCb({ ...cb, name: e.target.value })} />
            <select className={sel} value={cb.kind} onChange={(e) => setCb({ ...cb, kind: e.target.value })}><option value="cash">{tr("صندوق")}</option><option value="bank">{tr("بنك")}</option></select>
            <select className={sel} value={cb.account_id} onChange={(e) => setCb({ ...cb, account_id: e.target.value })}><option value="">{tr("الحساب المحاسبي (أصول)")}</option>{assetLeaves.map((a) => <option key={a.id} value={a.id}>{a.code} - {accName(a)}</option>)}</select>
            {cb.kind === "bank" && <Input placeholder={tr("رقم الحساب البنكي")} value={cb.bank_account_number} onChange={(e) => setCb({ ...cb, bank_account_number: e.target.value })} />}
          </div>
          <Button size="sm" onClick={addCash}>{tr("إضافة")}</Button>
          <div className="divide-y divide-border/50 text-sm">{cash.length ? cash.map((c) => <div key={c.id} className="flex justify-between py-2"><span>{c.name} ({c.kind === "bank" ? tr("بنك") : tr("صندوق")})</span><span className="text-muted-foreground">{c.chart_of_accounts?.code} {accName(c.chart_of_accounts)}</span></div>) : <p className="text-muted-foreground">{tr("لا توجد صناديق بعد")}</p>}</div>
        </section>
      )}
    </div>
  );
}
