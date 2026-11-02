import { createFileRoute } from "@tanstack/react-router";
import { BookOpen, Download, LoaderCircle } from "lucide-react";
import { useEffect, useMemo, useState } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { useCurrentUser } from "@/hooks/use-current-user";
import { supabase } from "@/integrations/supabase/client";
import { getLocale, tr } from "@/lib/i18n";
import { withCurrency } from "@/lib/currency";

export const Route = createFileRoute("/_authenticated/journal")({
  head: () => ({
    meta: [
      { title: tr("القيود اليومية | نظام الموارد البشرية") },
      { name: "description", content: tr("القيود المحاسبية المرحّلة من الرواتب مع تصدير Excel وCSV") },
      { property: "og:title", content: tr("القيود اليومية | نظام الموارد البشرية") },
      { property: "og:description", content: tr("القيود المحاسبية المرحّلة من الرواتب مع تصدير Excel وCSV") },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary_large_image" },
    ],
  }),
  component: JournalPage,
});

type Line = { id: string; debit: number; credit: number; memo: string | null; chart_of_accounts: { code: string; name_ar: string } | null };
type Entry = {
  id: string; entry_number: string; entry_date: string; description: string | null; source: string; status: string;
  branches: { name: string } | null; journal_entry_lines: Line[];
};

function money(n: number) {
  return withCurrency(Number(n).toLocaleString(getLocale(), { minimumFractionDigits: 2, maximumFractionDigits: 2 }));
}

function JournalPage() {
  const { isAdmin, loading: roleLoading } = useCurrentUser();
  const [entries, setEntries] = useState<Entry[]>([]);
  const [loading, setLoading] = useState(true);
  const [q, setQ] = useState("");

  useEffect(() => {
    if (!isAdmin) return;
    void (async () => {
      const { data } = await supabase
        .from("journal_entries")
        .select("id,entry_number,entry_date,description,source,status,branches(name),journal_entry_lines(id,debit,credit,memo,chart_of_accounts(code,name_ar))")
        .order("entry_date", { ascending: false })
        .order("created_at", { ascending: false });
      setEntries((data ?? []) as unknown as Entry[]);
      setLoading(false);
    })();
  }, [isAdmin]);

  const filtered = useMemo(() => {
    const s = q.trim();
    if (!s) return entries;
    return entries.filter((e) => [e.entry_number, e.description, e.branches?.name].some((v) => v?.includes(s)));
  }, [entries, q]);

  function exportCsv() {
    const head = [tr("رقم القيد"), tr("التاريخ"), tr("الفرع"), tr("البيان"), tr("رمز الحساب"), tr("اسم الحساب"), tr("مدين"), tr("دائن")];
    const rows = filtered.flatMap((e) =>
      e.journal_entry_lines.map((l) => [e.entry_number, e.entry_date, e.branches?.name ?? "", e.description ?? "", l.chart_of_accounts?.code ?? "", l.chart_of_accounts?.name_ar ?? "", l.debit, l.credit]),
    );
    const esc = (v: unknown) => `"${String(v ?? "").replace(/"/g, '""')}"`;
    const csv = "\uFEFF" + [head, ...rows].map((r) => r.map(esc).join(",")).join("\r\n");
    const url = URL.createObjectURL(new Blob([csv], { type: "text/csv;charset=utf-8" }));
    const a = document.createElement("a");
    a.href = url;
    a.download = `journal-entries.csv`;
    a.click();
    URL.revokeObjectURL(url);
  }

  if (!roleLoading && !isAdmin) {
    return <p className="rounded-2xl border border-border bg-card p-6 text-center text-sm text-muted-foreground shadow-glass">{tr("القيود المحاسبية متاحة لمدير النظام فقط.")}</p>;
  }

  return (
    <div className="mx-auto w-full max-w-6xl space-y-4 pb-6">
      <header className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h2 className="hidden text-xl font-bold text-foreground md:block md:text-2xl">{tr("القيود اليومية")}</h2>
          <p className="text-sm text-muted-foreground">{tr("القيود المحاسبية المرحّلة من الرواتب مع تصدير Excel وCSV")}</p>
        </div>
        <Button type="button" variant="outline" className="rounded-xl" onClick={exportCsv} disabled={!filtered.length}>
          <Download className="h-4 w-4" aria-hidden /> {tr("تصدير CSV / Excel")}
        </Button>
      </header>
      <Input value={q} onChange={(e) => setQ(e.target.value)} placeholder={tr("بحث برقم القيد أو البيان أو الفرع")} className="h-11 rounded-xl" />

      {loading ? (
        <div className="flex justify-center p-10"><LoaderCircle className="h-6 w-6 animate-spin text-primary" aria-hidden /></div>
      ) : !filtered.length ? (
        <div className="rounded-2xl border border-border bg-card p-8 text-center text-sm text-muted-foreground shadow-glass">
          <BookOpen className="mx-auto mb-2 h-8 w-8 text-primary" aria-hidden />
          {tr("لا توجد قيود بعد. اعتمد مسير الرواتب ثم اضغط «توليد قيد الرواتب» من صفحة الرواتب.")}
        </div>
      ) : (
        filtered.map((e) => {
          const d = e.journal_entry_lines.reduce((a, l) => a + Number(l.debit), 0);
          const c = e.journal_entry_lines.reduce((a, l) => a + Number(l.credit), 0);
          return (
            <section key={e.id} className="overflow-hidden rounded-2xl border border-border bg-card shadow-glass">
              <div className="flex flex-wrap items-center justify-between gap-2 border-b border-border p-4">
                <div>
                  <p className="font-bold text-foreground">{e.entry_number}</p>
                  <p className="text-xs text-muted-foreground">{e.entry_date} · {e.branches?.name ?? ""} · {e.description}</p>
                </div>
                <span className="rounded-full bg-primary/10 px-3 py-1 text-xs font-bold text-primary">{e.status === "posted" ? tr("مرحّل") : tr("مسودة")}</span>
              </div>
              <div className="overflow-x-auto">
                <table className="w-full text-sm">
                  <thead className="bg-muted/50 text-muted-foreground">
                    <tr><th className="p-2 text-start">{tr("الحساب")}</th><th className="p-2 text-end">{tr("مدين")}</th><th className="p-2 text-end">{tr("دائن")}</th></tr>
                  </thead>
                  <tbody>
                    {e.journal_entry_lines.map((l) => (
                      <tr key={l.id} className="border-t border-border">
                        <td className="p-2">{l.chart_of_accounts?.code} — {l.chart_of_accounts?.name_ar}</td>
                        <td className="p-2 text-end">{Number(l.debit) ? money(l.debit) : ""}</td>
                        <td className="p-2 text-end">{Number(l.credit) ? money(l.credit) : ""}</td>
                      </tr>
                    ))}
                    <tr className="border-t border-border bg-muted/30 font-bold">
                      <td className="p-2">{tr("الإجمالي")}</td><td className="p-2 text-end">{money(d)}</td><td className="p-2 text-end">{money(c)}</td>
                    </tr>
                  </tbody>
                </table>
              </div>
            </section>
          );
        })
      )}
    </div>
  );
}
