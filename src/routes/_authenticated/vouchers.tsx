import { createFileRoute } from "@tanstack/react-router";
import { useServerFn } from "@tanstack/react-start";
import { Download, LoaderCircle, Wallet } from "lucide-react";
import { useCallback, useEffect, useState } from "react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { useCurrentUser } from "@/hooks/use-current-user";
import { supabase } from "@/integrations/supabase/client";
import { createPaymentVoucher } from "@/lib/accounting.functions";
import { withCurrency } from "@/lib/currency";
import { getLocale, tr, accName } from "@/lib/i18n";

export const Route = createFileRoute("/_authenticated/vouchers")({
  head: () => ({
    meta: [
      { title: tr("سندات الصرف | نظام الموارد البشرية") },
      { name: "description", content: tr("سندات صرف الرواتب والسلف والمصروفات مع قيودها المحاسبية") },
      { property: "og:title", content: tr("سندات الصرف | نظام الموارد البشرية") },
      { property: "og:description", content: tr("سندات صرف الرواتب والسلف والمصروفات مع قيودها المحاسبية") },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary_large_image" },
    ],
  }),
  component: VouchersPage,
});

type Opt = { id: string; label: string };
type Voucher = { id: string; voucher_number: string; voucher_date: string; amount: number; description: string | null; cash_and_banks: { name: string } | null; journal_entries: { entry_number: string } | null };

const sel = "h-10 w-full rounded-xl border border-input bg-background px-3 text-sm";
const money = (n: number) => withCurrency(Number(n).toLocaleString(getLocale(), { minimumFractionDigits: 2 }));

function VouchersPage() {
  const { isAdmin, loading: roleLoading } = useCurrentUser();
  const create = useServerFn(createPaymentVoucher);
  const [cash, setCash] = useState<Opt[]>([]);
  const [accounts, setAccounts] = useState<Opt[]>([]);
  const [centers, setCenters] = useState<Opt[]>([]);
  const [branches, setBranches] = useState<Opt[]>([]);
  const [list, setList] = useState<Voucher[]>([]);
  const [busy, setBusy] = useState(false);
  const [f, setF] = useState({ date: new Date().toISOString().slice(0, 10), cashBankId: "", debitAccountId: "", costCenterId: "", branchId: "", amount: "", description: "" });

  const load = useCallback(async () => {
    const [c, a, cc, b, v] = await Promise.all([
      supabase.from("cash_and_banks").select("id,name,kind").eq("is_active", true),
      supabase.from("chart_of_accounts").select("id,code,name_ar,name_en").eq("is_parent", false).eq("is_active", true).order("code"),
      supabase.from("cost_centers").select("id,code,name").eq("is_active", true),
      supabase.from("branches").select("id,name"),
      supabase.from("payment_vouchers").select("id,voucher_number,voucher_date,amount,description,cash_and_banks(name),journal_entries!payment_vouchers_journal_entry_id_fkey(entry_number)").order("created_at", { ascending: false }),
    ]);
    setCash((c.data ?? []).map((x) => ({ id: x.id, label: `${x.name} (${x.kind === "bank" ? tr("بنك") : tr("صندوق")})` })));
    setAccounts((a.data ?? []).map((x) => ({ id: x.id, label: `${x.code} - ${accName(x)}` })));
    setCenters((cc.data ?? []).map((x) => ({ id: x.id, label: `${x.code} - ${x.name}` })));
    setBranches((b.data ?? []).map((x) => ({ id: x.id, label: x.name })));
    setList((v.data ?? []) as unknown as Voucher[]);
  }, []);
  useEffect(() => { if (isAdmin) void load(); }, [isAdmin, load]);

  async function submit() {
    const amount = Number(f.amount);
    if (!f.cashBankId || !f.debitAccountId || !(amount > 0) || !f.description.trim()) { toast.error(tr("أكمل الحقول المطلوبة")); return; }
    setBusy(true);
    try {
      const r = await create({ data: { date: f.date, cashBankId: f.cashBankId, debitAccountId: f.debitAccountId, costCenterId: f.costCenterId || null, branchId: f.branchId || null, amount, description: f.description } });
      if (!r.ok) toast.error(r.reason === "same_account" ? tr("لا يمكن أن يكون الحساب المدين هو حساب الصندوق") : tr("الصندوق غير نشط"));
      else { toast.success(`${tr("تم إنشاء السند")} ${r.voucherNumber}`); setF({ ...f, amount: "", description: "" }); void load(); }
    } catch (e) { toast.error((e as Error).message); } finally { setBusy(false); }
  }

  function exportCsv() {
    const rows = [["voucher", "date", "cash", "amount", "entry", "description"], ...list.map((v) => [v.voucher_number, v.voucher_date, v.cash_and_banks?.name ?? "", String(v.amount), v.journal_entries?.entry_number ?? "", v.description ?? ""])];
    const blob = new Blob(["\uFEFF" + rows.map((r) => r.map((c) => `"${c.replace(/"/g, '""')}"`).join(",")).join("\n")], { type: "text/csv" });
    const a = document.createElement("a"); a.href = URL.createObjectURL(blob); a.download = "payment-vouchers.csv"; a.click();
  }

  if (roleLoading) return <LoaderCircle className="mx-auto mt-10 animate-spin text-primary" />;
  if (!isAdmin) return <p className="p-6 text-center text-muted-foreground">{tr("هذه الصفحة للمدير فقط")}</p>;

  return (
    <div className="mx-auto w-full max-w-4xl space-y-4 pb-6">
      <section className="space-y-3 rounded-2xl border border-border/50 bg-card p-5 shadow-glass">
        <h2 className="flex items-center gap-2 text-lg font-bold"><Wallet className="size-5 text-primary" />{tr("سند صرف جديد")}</h2>
        <p className="text-xs text-muted-foreground">{tr("يُنشأ قيد مرحّل تلقائياً: مدين الحساب المختار، دائن الصندوق أو البنك.")}</p>
        {!cash.length && <p className="rounded-xl bg-muted p-3 text-sm">{tr("أضف صندوقاً أو بنكاً أولاً من صفحة دليل الحسابات.")}</p>}
        <div className="grid gap-3 sm:grid-cols-2">
          <label className="space-y-1 text-sm">{tr("التاريخ")}<Input type="date" value={f.date} onChange={(e) => setF({ ...f, date: e.target.value })} /></label>
          <label className="space-y-1 text-sm">{tr("المبلغ")}<Input type="number" min="0" step="0.01" value={f.amount} onChange={(e) => setF({ ...f, amount: e.target.value })} /></label>
          <label className="space-y-1 text-sm">{tr("الصرف من (صندوق/بنك)")}<select className={sel} value={f.cashBankId} onChange={(e) => setF({ ...f, cashBankId: e.target.value })}><option value="">—</option>{cash.map((o) => <option key={o.id} value={o.id}>{o.label}</option>)}</select></label>
          <label className="space-y-1 text-sm">{tr("الحساب المدين")}<select className={sel} value={f.debitAccountId} onChange={(e) => setF({ ...f, debitAccountId: e.target.value })}><option value="">—</option>{accounts.map((o) => <option key={o.id} value={o.id}>{o.label}</option>)}</select></label>
          <label className="space-y-1 text-sm">{tr("مركز التكلفة")}<select className={sel} value={f.costCenterId} onChange={(e) => setF({ ...f, costCenterId: e.target.value })}><option value="">—</option>{centers.map((o) => <option key={o.id} value={o.id}>{o.label}</option>)}</select></label>
          <label className="space-y-1 text-sm">{tr("الفرع")}<select className={sel} value={f.branchId} onChange={(e) => setF({ ...f, branchId: e.target.value })}><option value="">—</option>{branches.map((o) => <option key={o.id} value={o.id}>{o.label}</option>)}</select></label>
        </div>
        <label className="block space-y-1 text-sm">{tr("البيان")}<Input value={f.description} maxLength={300} onChange={(e) => setF({ ...f, description: e.target.value })} /></label>
        <Button onClick={submit} disabled={busy} className="w-full sm:w-auto">{busy && <LoaderCircle className="animate-spin" />}{tr("حفظ وترحيل السند")}</Button>
      </section>

      <section className="rounded-2xl border border-border/50 bg-card p-5 shadow-glass">
        <div className="mb-3 flex items-center justify-between"><h3 className="font-bold">{tr("سجل سندات الصرف")}</h3><Button variant="outline" size="sm" onClick={exportCsv} disabled={!list.length}><Download />CSV</Button></div>
        {!list.length ? <p className="text-sm text-muted-foreground">{tr("لا توجد سندات بعد")}</p> : (
          <div className="overflow-x-auto"><table className="w-full text-sm"><thead><tr className="text-muted-foreground"><th className="p-2 text-start">{tr("رقم السند")}</th><th className="p-2 text-start">{tr("التاريخ")}</th><th className="p-2 text-start">{tr("الصندوق")}</th><th className="p-2 text-start">{tr("المبلغ")}</th><th className="p-2 text-start">{tr("القيد")}</th><th className="p-2 text-start">{tr("البيان")}</th></tr></thead>
            <tbody>{list.map((v) => <tr key={v.id} className="border-t border-border/50"><td className="p-2">{v.voucher_number}</td><td className="p-2">{v.voucher_date}</td><td className="p-2">{v.cash_and_banks?.name}</td><td className="p-2">{money(v.amount)}</td><td className="p-2">{v.journal_entries?.entry_number}</td><td className="p-2">{v.description}</td></tr>)}</tbody></table></div>
        )}
      </section>
    </div>
  );
}
