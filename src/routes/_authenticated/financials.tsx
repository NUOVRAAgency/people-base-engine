import { createFileRoute } from "@tanstack/react-router";
import { Download, LoaderCircle } from "lucide-react";
import { useEffect, useMemo, useState } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { useCurrentUser } from "@/hooks/use-current-user";
import { supabase } from "@/integrations/supabase/client";
import { getLocale, tr, accName } from "@/lib/i18n";
import { withCurrency } from "@/lib/currency";
import { cn } from "@/lib/utils";

export const Route = createFileRoute("/_authenticated/financials")({
  head: () => ({
    meta: [
      { title: tr("القوائم المالية | نظام الموارد البشرية") },
      { name: "description", content: tr("ميزان المراجعة وقائمة الدخل والميزانية العمومية من القيود المرحّلة") },
      { property: "og:title", content: tr("القوائم المالية | نظام الموارد البشرية") },
      { property: "og:description", content: tr("ميزان المراجعة وقائمة الدخل والميزانية العمومية من القيود المرحّلة") },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary_large_image" },
    ],
  }),
  component: FinancialsPage,
});

type Account = { id: string; code: string; name_ar: string; name_en?: string | null; account_type: string; normal_side: string };
type Bal = Account & { debit: number; credit: number; balance: number };
type Tab = "trial" | "income" | "balance";

const money = (n: number) =>
  withCurrency(Number(n).toLocaleString(getLocale(), { minimumFractionDigits: 2, maximumFractionDigits: 2 }));

const typeOf = (t: string) => t.toLowerCase();
const isIncome = (t: string) => ["revenue", "income"].includes(typeOf(t));
const isExpense = (t: string) => typeOf(t) === "expense";

function FinancialsPage() {
  const { isAdmin, loading: roleLoading } = useCurrentUser();
  const today = new Date().toISOString().slice(0, 10);
  const [from, setFrom] = useState(today.slice(0, 4) + "-01-01");
  const [to, setTo] = useState(today);
  const [tab, setTab] = useState<Tab>("trial");
  const [rows, setRows] = useState<Bal[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (!isAdmin) return;
    setLoading(true);
    void (async () => {
      const [{ data: accs }, { data: lines }] = await Promise.all([
        supabase.from("chart_of_accounts").select("id,code,name_ar,name_en,account_type,normal_side").order("code"),
        supabase
          .from("journal_entry_lines")
          .select("account_id,debit,credit,journal_entries!inner(entry_date,status)")
          .eq("journal_entries.status", "posted")
          .gte("journal_entries.entry_date", from)
          .lte("journal_entries.entry_date", to),
      ]);
      const sums = new Map<string, { d: number; c: number }>();
      for (const l of (lines ?? []) as { account_id: string; debit: number; credit: number }[]) {
        const s = sums.get(l.account_id) ?? { d: 0, c: 0 };
        s.d += Number(l.debit);
        s.c += Number(l.credit);
        sums.set(l.account_id, s);
      }
      const out: Bal[] = [];
      for (const a of (accs ?? []) as Account[]) {
        const s = sums.get(a.id);
        if (!s) continue;
        const balance = a.normal_side === "credit" ? s.c - s.d : s.d - s.c;
        out.push({ ...a, debit: s.d, credit: s.c, balance });
      }
      setRows(out);
      setLoading(false);
    })();
  }, [isAdmin, from, to]);

  const income = useMemo(() => rows.filter((r) => isIncome(r.account_type)), [rows]);
  const expense = useMemo(() => rows.filter((r) => isExpense(r.account_type)), [rows]);
  const totalIncome = income.reduce((a, r) => a + r.balance, 0);
  const totalExpense = expense.reduce((a, r) => a + r.balance, 0);
  const netIncome = totalIncome - totalExpense;
  const assets = rows.filter((r) => typeOf(r.account_type) === "asset");
  const liabilities = rows.filter((r) => typeOf(r.account_type) === "liability");
  const equity = rows.filter((r) => typeOf(r.account_type) === "equity");
  const sum = (l: Bal[]) => l.reduce((a, r) => a + r.balance, 0);
  const td = rows.reduce((a, r) => a + r.debit, 0);
  const tc = rows.reduce((a, r) => a + r.credit, 0);

  function exportCsv() {
    let data: (string | number)[][] = [];
    if (tab === "trial") {
      data = [[tr("رمز الحساب"), tr("اسم الحساب"), tr("مدين"), tr("دائن")], ...rows.map((r) => [r.code, accName(r), r.debit, r.credit]), ["", tr("الإجمالي"), td, tc]];
    } else if (tab === "income") {
      data = [[tr("البند"), tr("المبلغ")], ...income.map((r) => [accName(r), r.balance]), [tr("إجمالي الإيرادات"), totalIncome], ...expense.map((r) => [accName(r), r.balance]), [tr("إجمالي المصروفات"), totalExpense], [tr("صافي الدخل"), netIncome]];
    } else {
      data = [[tr("البند"), tr("المبلغ")], ...assets.map((r) => [accName(r), r.balance]), [tr("إجمالي الأصول"), sum(assets)], ...liabilities.map((r) => [accName(r), r.balance]), [tr("إجمالي الخصوم"), sum(liabilities)], ...equity.map((r) => [accName(r), r.balance]), [tr("صافي دخل الفترة"), netIncome], [tr("إجمالي الخصوم وحقوق الملكية"), sum(liabilities) + sum(equity) + netIncome]];
    }
    const esc = (v: unknown) => `"${String(v ?? "").replace(/"/g, '""')}"`;
    const csv = "\uFEFF" + data.map((r) => r.map(esc).join(",")).join("\r\n");
    const url = URL.createObjectURL(new Blob([csv], { type: "text/csv;charset=utf-8" }));
    const a = document.createElement("a");
    a.href = url;
    a.download = `${tab}-${from}-${to}.csv`;
    a.click();
    URL.revokeObjectURL(url);
  }

  if (!roleLoading && !isAdmin) {
    return <p className="rounded-2xl border border-border bg-card p-6 text-center text-sm text-muted-foreground shadow-glass">{tr("القوائم المالية متاحة لمدير النظام فقط.")}</p>;
  }

  const tabs: { k: Tab; l: string }[] = [
    { k: "trial", l: tr("ميزان المراجعة") },
    { k: "income", l: tr("قائمة الدخل") },
    { k: "balance", l: tr("الميزانية العمومية") },
  ];

  const Section = ({ title, items, total }: { title: string; items: Bal[]; total: number }) => (
    <>
      <tr className="bg-muted/50"><td colSpan={2} className="p-2 font-bold text-foreground">{title}</td></tr>
      {items.map((r) => (
        <tr key={r.id} className="border-t border-border"><td className="p-2">{r.code} — {accName(r)}</td><td className="p-2 text-end">{money(r.balance)}</td></tr>
      ))}
      <tr className="border-t border-border font-bold"><td className="p-2">{tr("الإجمالي")} {title}</td><td className="p-2 text-end">{money(total)}</td></tr>
    </>
  );

  return (
    <div className="mx-auto w-full max-w-5xl space-y-4 pb-6">
      <header className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h2 className="hidden text-xl font-bold text-foreground md:block md:text-2xl">{tr("القوائم المالية")}</h2>
          <p className="text-sm text-muted-foreground">{tr("محسوبة آلياً من القيود المرحّلة في الأستاذ العام")}</p>
        </div>
        <Button type="button" variant="outline" className="rounded-xl" onClick={exportCsv} disabled={!rows.length}>
          <Download className="h-4 w-4" aria-hidden /> {tr("تصدير CSV / Excel")}
        </Button>
      </header>

      <div className="grid grid-cols-2 gap-3">
        <label className="text-xs text-muted-foreground">{tr("من تاريخ")}<Input type="date" value={from} onChange={(e) => setFrom(e.target.value)} className="mt-1 h-11 rounded-xl" /></label>
        <label className="text-xs text-muted-foreground">{tr("إلى تاريخ")}<Input type="date" value={to} onChange={(e) => setTo(e.target.value)} className="mt-1 h-11 rounded-xl" /></label>
      </div>

      <div className="flex gap-2 overflow-x-auto">
        {tabs.map((t) => (
          <button key={t.k} type="button" onClick={() => setTab(t.k)}
            className={cn("whitespace-nowrap rounded-xl px-4 py-2 text-sm font-bold", tab === t.k ? "bg-primary text-primary-foreground" : "bg-card text-foreground border border-border")}>
            {t.l}
          </button>
        ))}
      </div>

      {loading ? (
        <div className="flex justify-center p-10"><LoaderCircle className="h-6 w-6 animate-spin text-primary" aria-hidden /></div>
      ) : !rows.length ? (
        <p className="rounded-2xl border border-border bg-card p-8 text-center text-sm text-muted-foreground shadow-glass">{tr("لا توجد قيود مرحّلة في هذه الفترة.")}</p>
      ) : (
        <div className="overflow-x-auto rounded-2xl border border-border bg-card shadow-glass">
          <table className="w-full text-sm">
            {tab === "trial" ? (
              <>
                <thead className="bg-muted/50 text-muted-foreground">
                  <tr><th className="p-2 text-start">{tr("الحساب")}</th><th className="p-2 text-end">{tr("مدين")}</th><th className="p-2 text-end">{tr("دائن")}</th></tr>
                </thead>
                <tbody>
                  {rows.map((r) => (
                    <tr key={r.id} className="border-t border-border"><td className="p-2">{r.code} — {accName(r)}</td><td className="p-2 text-end">{money(r.debit)}</td><td className="p-2 text-end">{money(r.credit)}</td></tr>
                  ))}
                  <tr className="border-t border-border bg-muted/30 font-bold"><td className="p-2">{tr("الإجمالي")}</td><td className="p-2 text-end">{money(td)}</td><td className="p-2 text-end">{money(tc)}</td></tr>
                  <tr><td colSpan={3} className={cn("p-2 text-center text-xs font-bold", Math.abs(td - tc) < 0.01 ? "text-primary" : "text-destructive")}>
                    {Math.abs(td - tc) < 0.01 ? tr("الميزان متوازن") : tr("الميزان غير متوازن")}
                  </td></tr>
                </tbody>
              </>
            ) : tab === "income" ? (
              <tbody>
                <Section title={tr("الإيرادات")} items={income} total={totalIncome} />
                <Section title={tr("المصروفات")} items={expense} total={totalExpense} />
                <tr className="border-t-2 border-border bg-primary/10 font-bold"><td className="p-2">{netIncome >= 0 ? tr("صافي الربح") : tr("صافي الخسارة")}</td><td className="p-2 text-end">{money(netIncome)}</td></tr>
              </tbody>
            ) : (
              <tbody>
                <Section title={tr("الأصول")} items={assets} total={sum(assets)} />
                <Section title={tr("الخصوم")} items={liabilities} total={sum(liabilities)} />
                <Section title={tr("حقوق الملكية")} items={equity} total={sum(equity)} />
                <tr className="border-t border-border"><td className="p-2">{tr("صافي دخل الفترة")}</td><td className="p-2 text-end">{money(netIncome)}</td></tr>
                <tr className="border-t-2 border-border bg-primary/10 font-bold"><td className="p-2">{tr("إجمالي الخصوم وحقوق الملكية")}</td><td className="p-2 text-end">{money(sum(liabilities) + sum(equity) + netIncome)}</td></tr>
              </tbody>
            )}
          </table>
        </div>
      )}
    </div>
  );
}
