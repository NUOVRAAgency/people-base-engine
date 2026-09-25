import { createFileRoute } from "@tanstack/react-router";
import {
  BadgeCheck,
  Banknote,
  ChevronRight,
  ChevronLeft,
  CircleMinus,
  CirclePlus,
  HandCoins,
  LoaderCircle,
  Printer,
  Calculator,
  Trash2,
  UserRound,
  Wallet,
} from "lucide-react";
import { useCallback, useEffect, useMemo, useState, type FormEvent, type ReactNode } from "react";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { useCurrentUser } from "@/hooks/use-current-user";
import { supabase } from "@/integrations/supabase/client";
import { cn } from "@/lib/utils";

export const Route = createFileRoute("/_authenticated/payroll")({
  head: () => ({
    meta: [
      { title: "الرواتب | نظام الموارد البشرية" },
      { name: "description", content: "مسير الرواتب الشهري والمؤثرات المالية وقسائم الرواتب" },
      { property: "og:title", content: "الرواتب | نظام الموارد البشرية" },
      { property: "og:description", content: "مسير الرواتب الشهري والمؤثرات المالية وقسائم الرواتب" },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary_large_image" },
    ],
  }),
  component: PayrollPage,
});

type Employee = {
  id: string;
  full_name: string;
  employee_number: string;
  department: string | null;
  position: string | null;
};

type PayrollRow = {
  id: string;
  employee_id: string;
  month: string;
  base_salary: number;
  housing_allowance: number;
  transport_allowance: number;
  overtime_hours: number;
  overtime_amount: number;
  bonuses: number;
  deductions: number;
  net_salary: number;
  bank_name: string | null;
  status: string;
};

type Adjustment = {
  id: string;
  employee_id: string;
  month: string;
  kind: string;
  label: string;
  amount: number;
};

type Loan = {
  id: string;
  employee_id: string;
  total_amount: number;
  monthly_installment: number;
  paid_amount: number;
  start_month: string;
  status: string;
};

type TabKey = "sheet" | "adjustments" | "loans";

const numberFormatter = new Intl.NumberFormat("ar-YE-u-nu-latn", { maximumFractionDigits: 0 });
const monthFormatter = new Intl.DateTimeFormat("ar-YE-u-nu-latn", { month: "long", year: "numeric" });

function money(value: number) {
  return `${numberFormatter.format(Math.round(value))} ر.ي`;
}

function monthKey(date: Date) {
  return `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, "0")}-01`;
}

function monthLabel(key: string) {
  return monthFormatter.format(new Date(`${key}T00:00:00`));
}

function num(value: string) {
  const parsed = Number(value);
  return Number.isFinite(parsed) && parsed > 0 ? parsed : 0;
}

function PayrollPage() {
  const { isAdmin, loading: roleLoading } = useCurrentUser();
  const [month, setMonth] = useState(() => monthKey(new Date()));
  const [tab, setTab] = useState<TabKey>("sheet");
  const [employees, setEmployees] = useState<Employee[]>([]);
  const [rows, setRows] = useState<PayrollRow[]>([]);
  const [adjustments, setAdjustments] = useState<Adjustment[]>([]);
  const [loans, setLoans] = useState<Loan[]>([]);
  const [loading, setLoading] = useState(true);
  const [busy, setBusy] = useState("");
  const [search, setSearch] = useState("");
  const [feedback, setFeedback] = useState<{ kind: "success" | "error"; message: string } | null>(null);
  const [payslipId, setPayslipId] = useState("");
  const [editRow, setEditRow] = useState<PayrollRow | null>(null);

  const load = useCallback(async () => {
    setLoading(true);
    const [employeesResult, rowsResult, adjustmentsResult, loansResult] = await Promise.all([
      supabase.from("employees").select("id,full_name,employee_number,department,position").eq("status", "active").order("full_name"),
      supabase.from("payroll").select("*").eq("month", month),
      supabase.from("payroll_adjustments").select("id,employee_id,month,kind,label,amount").eq("month", month).order("created_at", { ascending: false }),
      supabase.from("employee_loans").select("id,employee_id,total_amount,monthly_installment,paid_amount,start_month,status").order("created_at", { ascending: false }),
    ]);
    setEmployees((employeesResult.data ?? []) as Employee[]);
    setRows((rowsResult.data ?? []) as PayrollRow[]);
    setAdjustments((adjustmentsResult.data ?? []) as Adjustment[]);
    setLoans((loansResult.data ?? []) as Loan[]);
    setLoading(false);
  }, [month]);

  useEffect(() => {
    void load();
  }, [load]);

  const employeeById = useMemo(() => new Map(employees.map((item) => [item.id, item])), [employees]);

  const lines = useMemo(() => {
    return rows.map((row) => {
      const additions = adjustments
        .filter((item) => item.employee_id === row.employee_id && item.kind === "addition")
        .reduce((total, item) => total + Number(item.amount), 0);
      const extraDeductions = adjustments
        .filter((item) => item.employee_id === row.employee_id && item.kind === "deduction")
        .reduce((total, item) => total + Number(item.amount), 0);
      const loan = loans.find(
        (item) => item.employee_id === row.employee_id && item.status === "active" && item.start_month <= row.month,
      );
      const installment = loan ? Math.min(Number(loan.monthly_installment), Number(loan.total_amount) - Number(loan.paid_amount)) : 0;
      const allowances =
        Number(row.housing_allowance) + Number(row.transport_allowance) + Number(row.bonuses) + Number(row.overtime_amount) + additions;
      const totalDeductions = Number(row.deductions) + extraDeductions + installment;
      const absenceDeduction = Math.max(
        0,
        Number(row.base_salary) +
          Number(row.housing_allowance) +
          Number(row.transport_allowance) +
          Number(row.bonuses) +
          Number(row.overtime_amount) -
          Number(row.deductions) -
          Number(row.net_salary),
      );
      const net = Number(row.net_salary) + additions - extraDeductions - installment;
      return {
        row,
        employee: employeeById.get(row.employee_id),
        additions,
        extraDeductions,
        installment,
        allowances,
        totalDeductions: totalDeductions + absenceDeduction,
        absenceDeduction,
        net,
      };
    });
  }, [rows, adjustments, loans, employeeById]);

  const visibleLines = useMemo(() => {
    const term = search.trim();
    if (!term) return lines;
    return lines.filter(
      (line) => (line.employee?.full_name ?? "").includes(term) || (line.employee?.employee_number ?? "").includes(term),
    );
  }, [lines, search]);

  const totals = useMemo(() => {
    return lines.reduce(
      (acc, line) => ({
        net: acc.net + line.net,
        additions: acc.additions + line.allowances,
        deductions: acc.deductions + line.totalDeductions,
      }),
      { net: 0, additions: 0, deductions: 0 },
    );
  }, [lines]);

  const sheetStatus = useMemo(() => {
    if (!rows.length) return { key: "none", label: "لم ينشأ بعد", tone: "bg-muted text-muted-foreground" };
    if (rows.every((row) => row.status === "approved")) return { key: "approved", label: "معتمد ومصروف", tone: "bg-success/12 text-success" };
    if (rows.some((row) => row.status === "review")) return { key: "review", label: "قيد المراجعة", tone: "bg-warning/20 text-warning-foreground" };
    return { key: "draft", label: "مسودة", tone: "bg-primary/10 text-primary" };
  }, [rows]);

  const payslip = visibleLines.find((line) => line.row.id === payslipId) ?? lines.find((line) => line.row.id === payslipId);

  function shiftMonth(step: number) {
    const current = new Date(`${month}T00:00:00`);
    current.setMonth(current.getMonth() + step);
    setMonth(monthKey(current));
  }

  async function generateSheet() {
    setFeedback(null);
    setBusy("generate");
    const missing = employees.filter((employee) => !rows.some((row) => row.employee_id === employee.id));
    if (!missing.length) {
      setBusy("");
      setFeedback({ kind: "error", message: "مسير هذا الشهر مكتمل لجميع الموظفين" });
      return;
    }
    const previous = new Date(`${month}T00:00:00`);
    previous.setMonth(previous.getMonth() - 1);
    const { data: previousRows } = await supabase
      .from("payroll")
      .select("employee_id,base_salary,housing_allowance,transport_allowance,bank_name")
      .eq("month", monthKey(previous));

    const payload = missing.map((employee) => {
      const last = (previousRows ?? []).find((item) => item.employee_id === employee.id);
      return {
        employee_id: employee.id,
        month,
        base_salary: Number(last?.base_salary ?? 0),
        housing_allowance: Number(last?.housing_allowance ?? 0),
        transport_allowance: Number(last?.transport_allowance ?? 0),
        bank_name: last?.bank_name ?? null,
        status: "draft",
      };
    });
    const { error } = await supabase.from("payroll").insert(payload);
    setBusy("");
    if (error) {
      setFeedback({ kind: "error", message: "تعذر توليد المسير. صلاحية الرواتب للمدير فقط." });
      return;
    }
    setFeedback({ kind: "success", message: `تم توليد مسير ${monthLabel(month)} لعدد ${numberFormatter.format(payload.length)} موظف` });
    await load();
  }

  async function approveSheet() {
    setFeedback(null);
    if (!rows.length) {
      setFeedback({ kind: "error", message: "ولد مسير الشهر اولا" });
      return;
    }
    setBusy("approve");
    const { error } = await supabase.from("payroll").update({ status: "approved" }).eq("month", month);
    setBusy("");
    if (error) {
      setFeedback({ kind: "error", message: "تعذر اعتماد المسير. حاول مرة اخرى." });
      return;
    }
    setFeedback({ kind: "success", message: "تم اعتماد المسير وتسجيل صرف الرواتب" });
    await load();
  }

  async function saveRow(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!editRow) return;
    const form = new FormData(event.currentTarget);
    setBusy("row");
    const { error } = await supabase
      .from("payroll")
      .update({
        base_salary: num(String(form.get("base_salary") ?? "")),
        housing_allowance: num(String(form.get("housing_allowance") ?? "")),
        transport_allowance: num(String(form.get("transport_allowance") ?? "")),
        overtime_hours: num(String(form.get("overtime_hours") ?? "")),
        overtime_amount: num(String(form.get("overtime_amount") ?? "")),
        bonuses: num(String(form.get("bonuses") ?? "")),
        deductions: num(String(form.get("deductions") ?? "")),
        bank_name: String(form.get("bank_name") ?? "").trim() || null,
      })
      .eq("id", editRow.id);
    setBusy("");
    if (error) {
      setFeedback({ kind: "error", message: "لم يتم حفظ بيانات الراتب" });
      return;
    }
    setEditRow(null);
    setFeedback({ kind: "success", message: "تم تحديث بيانات الراتب" });
    await load();
  }

  return (
    <div className="mx-auto w-full max-w-6xl space-y-5 pb-6">
      <header className="space-y-3">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <div>
            <h2 className="hidden text-xl font-bold leading-[1.6] text-foreground md:block md:text-2xl">الرواتب</h2>
            <p className="text-sm leading-[1.7] text-muted-foreground">مسير الرواتب الشهري والمؤثرات المالية وقسائم الرواتب</p>
          </div>
          <div className="flex items-center gap-1 rounded-full border border-border bg-card p-1 shadow-glass">
            <Button type="button" variant="ghost" size="icon" className="size-9 rounded-full" aria-label="الشهر السابق" onClick={() => shiftMonth(-1)}>
              <ChevronRight className="h-4 w-4" aria-hidden />
            </Button>
            <span className="min-w-[124px] text-center text-sm font-bold text-foreground">{monthLabel(month)}</span>
            <Button type="button" variant="ghost" size="icon" className="size-9 rounded-full" aria-label="الشهر التالي" onClick={() => shiftMonth(1)}>
              <ChevronLeft className="h-4 w-4" aria-hidden />
            </Button>
          </div>
        </div>
      </header>

      {!roleLoading && !isAdmin ? (
        <p className="rounded-2xl border border-border bg-card p-6 text-center text-sm leading-[1.8] text-muted-foreground shadow-glass">
          بيانات الرواتب متاحة لمدير النظام فقط.
        </p>
      ) : (
        <>
          <section className="grid grid-cols-2 gap-3 lg:grid-cols-4">
            <KpiCard icon={<Wallet className="h-5 w-5" aria-hidden />} title="إجمالي رواتب الشهر" value={money(totals.net)} tone="text-primary" />
            <KpiCard
              icon={<BadgeCheck className="h-5 w-5" aria-hidden />}
              title="حالة المسير"
              value={sheetStatus.label}
              tone="text-foreground"
              badgeClass={sheetStatus.tone}
            />
            <KpiCard icon={<CircleMinus className="h-5 w-5" aria-hidden />} title="إجمالي الخصومات" value={money(totals.deductions)} tone="text-destructive" />
            <KpiCard icon={<CirclePlus className="h-5 w-5" aria-hidden />} title="إجمالي الإضافات" value={money(totals.additions)} tone="text-success" />
          </section>

          <section className="flex flex-col gap-2 rounded-2xl border border-border bg-card p-4 shadow-glass sm:flex-row sm:items-center">
            <Button type="button" className="h-11 flex-1 rounded-xl text-sm font-bold" onClick={() => void generateSheet()} disabled={busy === "generate"}>
              {busy === "generate" ? <LoaderCircle className="h-4 w-4 animate-spin" aria-hidden /> : <Calculator className="h-4 w-4" aria-hidden />}
              توليد مسير رواتب الشهر
            </Button>
            <Button
              type="button"
              variant="outline"
              className="h-11 flex-1 rounded-xl border-success/40 text-sm font-bold text-success hover:bg-success/10 hover:text-success"
              onClick={() => void approveSheet()}
              disabled={busy === "approve" || sheetStatus.key === "approved"}
            >
              {busy === "approve" ? <LoaderCircle className="h-4 w-4 animate-spin" aria-hidden /> : <BadgeCheck className="h-4 w-4" aria-hidden />}
              اعتماد وصرف الرواتب
            </Button>
          </section>

          {feedback ? (
            <p
              className={cn(
                "rounded-xl border p-3 text-center text-sm leading-[1.7]",
                feedback.kind === "success" ? "border-success/30 bg-success/10 text-success" : "border-destructive/30 bg-destructive/10 text-destructive",
              )}
            >
              {feedback.message}
            </p>
          ) : null}

          <nav className="flex gap-1 overflow-x-auto rounded-full border border-border bg-card p-1 shadow-glass scrollbar-hide">
            {([
              { key: "sheet", label: "مسير الرواتب" },
              { key: "adjustments", label: "المؤثرات المالية" },
              { key: "loans", label: "السُلف والأقساط" },
            ] as { key: TabKey; label: string }[]).map((item) => (
              <button
                key={item.key}
                type="button"
                onClick={() => setTab(item.key)}
                className={cn(
                  "flex-1 whitespace-nowrap rounded-full px-2.5 py-2 text-[13px] font-bold transition-colors md:px-4 md:text-sm",
                  tab === item.key ? "bg-primary text-primary-foreground" : "text-muted-foreground hover:bg-muted",
                )}
              >
                {item.label}
              </button>
            ))}
          </nav>

          {loading ? (
            <p className="flex items-center justify-center gap-2 rounded-2xl border border-border bg-card p-10 text-sm text-muted-foreground shadow-glass">
              <LoaderCircle className="h-4 w-4 animate-spin" aria-hidden />
              جاري تحميل بيانات الرواتب
            </p>
          ) : tab === "sheet" ? (
            <section className="space-y-3">
              <Input
                value={search}
                onChange={(event) => setSearch(event.target.value)}
                placeholder="ابحث باسم الموظف أو رقمه الوظيفي"
                className="h-11 rounded-xl"
              />

              {!visibleLines.length ? (
                <EmptyState
                  title={rows.length ? "لا نتائج مطابقة" : "لا يوجد مسير لهذا الشهر"}
                  detail={rows.length ? "جرب اسما او رقما اخر" : "اضغط زر التوليد بالاعلى للبدء"}
                />
              ) : (
                <>
                  <ul className="space-y-3 md:hidden">
                    {visibleLines.map((line) => (
                      <li key={line.row.id}>
                        <button
                          type="button"
                          onClick={() => setPayslipId(line.row.id)}
                          className="w-full rounded-2xl border border-border bg-card p-4 text-start shadow-glass transition-shadow hover:shadow-card"
                        >
                          <div className="flex items-center gap-3">
                            <span className="flex size-10 shrink-0 items-center justify-center rounded-full bg-primary/10 text-primary">
                              <UserRound className="h-5 w-5" aria-hidden />
                            </span>
                            <span className="min-w-0 flex-1">
                              <span className="block truncate text-sm font-bold text-foreground">{line.employee?.full_name ?? "موظف"}</span>
                              <span className="block text-xs text-muted-foreground">{line.employee?.employee_number}</span>
                            </span>
                            <span className="text-end">
                              <span className="block text-[11px] text-muted-foreground">الصافي</span>
                              <span className="block text-sm font-bold text-success">{money(line.net)}</span>
                            </span>
                          </div>
                          <dl className="mt-3 grid grid-cols-2 gap-2 border-t border-border pt-3 text-xs">
                            <MiniStat label="الراتب الأساسي" value={money(Number(line.row.base_salary))} />
                            <MiniStat label="البدلات والإضافات" value={money(line.allowances)} />
                            <MiniStat label="ساعات الإضافي" value={numberFormatter.format(Number(line.row.overtime_hours))} />
                            <MiniStat label="الخصومات" value={money(line.totalDeductions)} className="text-destructive" />
                          </dl>
                        </button>
                      </li>
                    ))}
                  </ul>

                  <div className="hidden overflow-hidden rounded-2xl border border-border bg-card shadow-glass md:block">
                    <table className="w-full text-sm">
                      <thead className="bg-muted/60 text-xs text-muted-foreground">
                        <tr>
                          <th className="px-4 py-3 text-start font-bold">الموظف</th>
                          <th className="px-4 py-3 text-start font-bold">الأساسي</th>
                          <th className="px-4 py-3 text-start font-bold">البدلات والإضافات</th>
                          <th className="px-4 py-3 text-start font-bold">الإضافي (ساعة)</th>
                          <th className="px-4 py-3 text-start font-bold">الخصومات والغياب</th>
                          <th className="px-4 py-3 text-start font-bold">الصافي</th>
                          <th className="px-4 py-3 text-start font-bold">إجراءات</th>
                        </tr>
                      </thead>
                      <tbody>
                        {visibleLines.map((line) => (
                          <tr key={line.row.id} className="border-t border-border transition-colors hover:bg-muted/40">
                            <td className="px-4 py-3">
                              <span className="block font-bold text-foreground">{line.employee?.full_name ?? "موظف"}</span>
                              <span className="block text-xs text-muted-foreground">
                                {line.employee?.employee_number}
                                {line.employee?.department ? ` — ${line.employee.department}` : ""}
                              </span>
                            </td>
                            <td className="px-4 py-3">{money(Number(line.row.base_salary))}</td>
                            <td className="px-4 py-3 text-success">{money(line.allowances)}</td>
                            <td className="px-4 py-3">{numberFormatter.format(Number(line.row.overtime_hours))}</td>
                            <td className="px-4 py-3 text-destructive">{money(line.totalDeductions)}</td>
                            <td className="px-4 py-3 font-bold text-foreground">{money(line.net)}</td>
                            <td className="px-4 py-3">
                              <div className="flex items-center gap-1">
                                <Button type="button" variant="ghost" size="sm" className="rounded-lg text-primary" onClick={() => setPayslipId(line.row.id)}>
                                  القسيمة
                                </Button>
                                <Button type="button" variant="ghost" size="sm" className="rounded-lg" onClick={() => setEditRow(line.row)}>
                                  تعديل
                                </Button>
                              </div>
                            </td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                </>
              )}
            </section>
          ) : tab === "adjustments" ? (
            <AdjustmentsTab
              month={month}
              employees={employees}
              adjustments={adjustments}
              employeeById={employeeById}
              onChanged={load}
              onFeedback={setFeedback}
            />
          ) : (
            <LoansTab employees={employees} loans={loans} employeeById={employeeById} onChanged={load} onFeedback={setFeedback} />
          )}
        </>
      )}

      <Dialog open={Boolean(payslip)} onOpenChange={(open) => !open && setPayslipId("")}>
        <DialogContent className="max-h-[92dvh] max-w-lg overflow-y-auto rounded-2xl">
          <DialogHeader className="no-print">
            <DialogTitle className="text-base font-bold">قسيمة الراتب</DialogTitle>
            <DialogDescription className="text-xs">قسيمة {monthLabel(month)} — يمكنك طباعتها أو حفظها بصيغة PDF</DialogDescription>
          </DialogHeader>
          {payslip ? (
            <>
              <div className="print-area space-y-4 rounded-2xl border border-border bg-white p-5 text-foreground">
                <div className="border-b border-border pb-3 text-center">
                  <p className="text-base font-bold">قسيمة راتب</p>
                  <p className="mt-1 text-xs text-muted-foreground">شهر {monthLabel(month)}</p>
                </div>

                <dl className="grid grid-cols-2 gap-2 text-xs">
                  <MiniStat label="الموظف" value={payslip.employee?.full_name ?? "موظف"} />
                  <MiniStat label="الرقم الوظيفي" value={payslip.employee?.employee_number ?? "—"} />
                  <MiniStat label="القسم" value={payslip.employee?.department ?? "—"} />
                  <MiniStat label="المسمى الوظيفي" value={payslip.employee?.position ?? "—"} />
                  <MiniStat label="البنك" value={payslip.row.bank_name ?? "—"} />
                  <MiniStat label="حالة المسير" value={sheetStatus.label} />
                </dl>

                <div className="grid gap-3 sm:grid-cols-2">
                  <div className="rounded-xl border border-success/25 bg-success/5 p-3">
                    <p className="mb-2 text-xs font-bold text-success">المستحقات</p>
                    <PayslipLine label="الراتب الأساسي" value={money(Number(payslip.row.base_salary))} />
                    <PayslipLine label="بدل السكن" value={money(Number(payslip.row.housing_allowance))} />
                    <PayslipLine label="بدل النقل" value={money(Number(payslip.row.transport_allowance))} />
                    <PayslipLine label="أجر الإضافي" value={money(Number(payslip.row.overtime_amount))} />
                    <PayslipLine label="مكافآت" value={money(Number(payslip.row.bonuses))} />
                    <PayslipLine label="مستحقات أخرى" value={money(payslip.additions)} />
                  </div>
                  <div className="rounded-xl border border-destructive/25 bg-destructive/5 p-3">
                    <p className="mb-2 text-xs font-bold text-destructive">الاستقطاعات</p>
                    <PayslipLine label="خصومات ثابتة" value={money(Number(payslip.row.deductions))} />
                    <PayslipLine label="استقطاعات أخرى" value={money(payslip.extraDeductions)} />
                    <PayslipLine label="قسط سلفة" value={money(payslip.installment)} />
                    <PayslipLine label="خصم الغياب غير المبرر" value={money(payslip.absenceDeduction)} />
                  </div>
                </div>

                <div className="flex items-center justify-between rounded-xl bg-primary/10 px-4 py-3">
                  <span className="text-sm font-bold text-primary">صافي الراتب</span>
                  <span className="text-base font-bold text-primary">{money(payslip.net)}</span>
                </div>
                <p className="text-center text-[11px] leading-[1.8] text-muted-foreground">
                  هذه القسيمة صادرة إلكترونياً من نظام الموارد البشرية ولا تحتاج إلى توقيع.
                </p>
              </div>

              <Button type="button" className="no-print h-11 rounded-xl text-sm font-bold" onClick={() => window.print()}>
                <Printer className="h-4 w-4" aria-hidden />
                طباعة / حفظ PDF
              </Button>
            </>
          ) : null}
        </DialogContent>
      </Dialog>

      <Dialog open={Boolean(editRow)} onOpenChange={(open) => !open && setEditRow(null)}>
        <DialogContent className="max-h-[92dvh] max-w-md overflow-y-auto rounded-2xl">
          <DialogHeader>
            <DialogTitle className="text-base font-bold">تعديل راتب الموظف</DialogTitle>
            <DialogDescription className="text-xs">{employeeById.get(editRow?.employee_id ?? "")?.full_name ?? ""}</DialogDescription>
          </DialogHeader>
          {editRow ? (
            <form className="space-y-3" onSubmit={(event) => void saveRow(event)}>
              <div className="grid grid-cols-2 gap-3">
                <MoneyField name="base_salary" label="الراتب الأساسي" defaultValue={editRow.base_salary} />
                <MoneyField name="housing_allowance" label="بدل السكن" defaultValue={editRow.housing_allowance} />
                <MoneyField name="transport_allowance" label="بدل النقل" defaultValue={editRow.transport_allowance} />
                <MoneyField name="bonuses" label="مكافآت" defaultValue={editRow.bonuses} />
                <MoneyField name="overtime_hours" label="ساعات الإضافي" defaultValue={editRow.overtime_hours} />
                <MoneyField name="overtime_amount" label="أجر الإضافي" defaultValue={editRow.overtime_amount} />
                <MoneyField name="deductions" label="خصومات ثابتة" defaultValue={editRow.deductions} />
                <label className="space-y-1.5 text-sm">
                  <span className="block font-bold text-foreground">اسم البنك</span>
                  <Input name="bank_name" defaultValue={editRow.bank_name ?? ""} className="h-11 rounded-xl" />
                </label>
              </div>
              <Button type="submit" className="h-11 w-full rounded-xl text-sm font-bold" disabled={busy === "row"}>
                {busy === "row" ? <LoaderCircle className="h-4 w-4 animate-spin" aria-hidden /> : null}
                حفظ التعديلات
              </Button>
            </form>
          ) : null}
        </DialogContent>
      </Dialog>
    </div>
  );
}

function AdjustmentsTab({
  month,
  employees,
  adjustments,
  employeeById,
  onChanged,
  onFeedback,
}: {
  month: string;
  employees: Employee[];
  adjustments: Adjustment[];
  employeeById: Map<string, Employee>;
  onChanged: () => Promise<void>;
  onFeedback: (value: { kind: "success" | "error"; message: string }) => void;
}) {
  const [employeeId, setEmployeeId] = useState("");
  const [kind, setKind] = useState("addition");
  const [label, setLabel] = useState("");
  const [amount, setAmount] = useState("");
  const [saving, setSaving] = useState(false);

  async function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!employeeId || label.trim().length < 2 || num(amount) <= 0) {
      onFeedback({ kind: "error", message: "اختر الموظف واكتب البيان والمبلغ" });
      return;
    }
    setSaving(true);
    const { error } = await supabase.from("payroll_adjustments").insert({
      employee_id: employeeId,
      month,
      kind,
      label: label.trim(),
      amount: num(amount),
    });
    setSaving(false);
    if (error) {
      onFeedback({ kind: "error", message: "لم يتم حفظ المؤثر المالي" });
      return;
    }
    setLabel("");
    setAmount("");
    onFeedback({ kind: "success", message: "تمت إضافة المؤثر المالي إلى مسير الشهر" });
    await onChanged();
  }

  async function remove(id: string) {
    const { error } = await supabase.from("payroll_adjustments").delete().eq("id", id);
    if (error) {
      onFeedback({ kind: "error", message: "تعذّر حذف المؤثر المالي" });
      return;
    }
    await onChanged();
  }

  return (
    <section className="grid gap-3 lg:grid-cols-[minmax(0,320px)_1fr]">
      <form onSubmit={(event) => void submit(event)} className="space-y-3 rounded-2xl border border-border bg-card p-4 shadow-glass">
        <p className="text-sm font-bold text-foreground">إضافة مستحق أو استقطاع</p>
        <FieldSelect label="الموظف" value={employeeId} onChange={setEmployeeId} placeholder="اختر الموظف">
          {employees.map((employee) => (
            <SelectItem key={employee.id} value={employee.id}>
              {employee.full_name}
            </SelectItem>
          ))}
        </FieldSelect>
        <FieldSelect label="النوع" value={kind} onChange={setKind} placeholder="النوع">
          <SelectItem value="addition">مستحق (مكافأة / بدل)</SelectItem>
          <SelectItem value="deduction">استقطاع (خصم / جزاء)</SelectItem>
        </FieldSelect>
        <label className="block space-y-1.5 text-sm">
          <span className="block font-bold text-foreground">البيان</span>
          <Input value={label} onChange={(event) => setLabel(event.target.value)} className="h-11 rounded-xl" placeholder="مكافأة أداء" />
        </label>
        <label className="block space-y-1.5 text-sm">
          <span className="block font-bold text-foreground">المبلغ</span>
          <Input
            value={amount}
            onChange={(event) => setAmount(event.target.value.replace(/[^\d.]/g, ""))}
            inputMode="decimal"
            dir="ltr"
            className="h-11 rounded-xl text-left"
          />
        </label>
        <Button type="submit" className="h-11 w-full rounded-xl text-sm font-bold" disabled={saving}>
          {saving ? <LoaderCircle className="h-4 w-4 animate-spin" aria-hidden /> : <CirclePlus className="h-4 w-4" aria-hidden />}
          إضافة وحفظ
        </Button>
      </form>

      <div className="space-y-2">
        {!adjustments.length ? (
          <EmptyState title="لا توجد مؤثرات مالية لهذا الشهر" detail="أضف مكافأة أو خصماً ليظهر أثره مباشرة في مسير الرواتب" />
        ) : (
          adjustments.map((item) => (
            <div key={item.id} className="flex items-center gap-3 rounded-2xl border border-border bg-card p-4 shadow-glass">
              <span
                className={cn(
                  "flex size-10 shrink-0 items-center justify-center rounded-full",
                  item.kind === "addition" ? "bg-success/10 text-success" : "bg-destructive/10 text-destructive",
                )}
              >
                {item.kind === "addition" ? <CirclePlus className="h-5 w-5" aria-hidden /> : <CircleMinus className="h-5 w-5" aria-hidden />}
              </span>
              <span className="min-w-0 flex-1">
                <span className="block truncate text-sm font-bold text-foreground">{item.label}</span>
                <span className="block text-xs text-muted-foreground">{employeeById.get(item.employee_id)?.full_name ?? "موظف"}</span>
              </span>
              <span className={cn("text-sm font-bold", item.kind === "addition" ? "text-success" : "text-destructive")}>{money(Number(item.amount))}</span>
              <Button type="button" variant="ghost" size="icon" className="size-9 rounded-full text-muted-foreground" aria-label="حذف" onClick={() => void remove(item.id)}>
                <Trash2 className="h-4 w-4" aria-hidden />
              </Button>
            </div>
          ))
        )}
      </div>
    </section>
  );
}

function LoansTab({
  employees,
  loans,
  employeeById,
  onChanged,
  onFeedback,
}: {
  employees: Employee[];
  loans: Loan[];
  employeeById: Map<string, Employee>;
  onChanged: () => Promise<void>;
  onFeedback: (value: { kind: "success" | "error"; message: string }) => void;
}) {
  const [employeeId, setEmployeeId] = useState("");
  const [total, setTotal] = useState("");
  const [installment, setInstallment] = useState("");
  const [saving, setSaving] = useState(false);

  async function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!employeeId || num(total) <= 0 || num(installment) <= 0) {
      onFeedback({ kind: "error", message: "اختر الموظف وأدخل مبلغ السلفة والقسط الشهري" });
      return;
    }
    if (num(installment) > num(total)) {
      onFeedback({ kind: "error", message: "القسط الشهري أكبر من مبلغ السلفة" });
      return;
    }
    setSaving(true);
    const { error } = await supabase.from("employee_loans").insert({
      employee_id: employeeId,
      total_amount: num(total),
      monthly_installment: num(installment),
      start_month: monthKey(new Date()),
    });
    setSaving(false);
    if (error) {
      onFeedback({ kind: "error", message: "لم يتم حفظ السلفة" });
      return;
    }
    setTotal("");
    setInstallment("");
    onFeedback({ kind: "success", message: "تم تسجيل السلفة وسيُخصم القسط شهرياً" });
    await onChanged();
  }

  async function payInstallment(loan: Loan) {
    const paid = Math.min(Number(loan.total_amount), Number(loan.paid_amount) + Number(loan.monthly_installment));
    const { error } = await supabase
      .from("employee_loans")
      .update({ paid_amount: paid, status: paid >= Number(loan.total_amount) ? "closed" : "active" })
      .eq("id", loan.id);
    if (error) {
      onFeedback({ kind: "error", message: "تعذّر تسجيل سداد القسط" });
      return;
    }
    onFeedback({ kind: "success", message: "تم تسجيل سداد قسط الشهر" });
    await onChanged();
  }

  return (
    <section className="grid gap-3 lg:grid-cols-[minmax(0,320px)_1fr]">
      <form onSubmit={(event) => void submit(event)} className="space-y-3 rounded-2xl border border-border bg-card p-4 shadow-glass">
        <p className="text-sm font-bold text-foreground">تسجيل سلفة جديدة</p>
        <FieldSelect label="الموظف" value={employeeId} onChange={setEmployeeId} placeholder="اختر الموظف">
          {employees.map((employee) => (
            <SelectItem key={employee.id} value={employee.id}>
              {employee.full_name}
            </SelectItem>
          ))}
        </FieldSelect>
        <label className="block space-y-1.5 text-sm">
          <span className="block font-bold text-foreground">مبلغ السلفة</span>
          <Input value={total} onChange={(event) => setTotal(event.target.value.replace(/[^\d.]/g, ""))} inputMode="decimal" dir="ltr" className="h-11 rounded-xl text-left" />
        </label>
        <label className="block space-y-1.5 text-sm">
          <span className="block font-bold text-foreground">القسط الشهري</span>
          <Input
            value={installment}
            onChange={(event) => setInstallment(event.target.value.replace(/[^\d.]/g, ""))}
            inputMode="decimal"
            dir="ltr"
            className="h-11 rounded-xl text-left"
          />
        </label>
        <Button type="submit" className="h-11 w-full rounded-xl text-sm font-bold" disabled={saving}>
          {saving ? <LoaderCircle className="h-4 w-4 animate-spin" aria-hidden /> : <HandCoins className="h-4 w-4" aria-hidden />}
          إضافة وحفظ
        </Button>
      </form>

      <div className="space-y-2">
        {!loans.length ? (
          <EmptyState title="لا توجد سُلف مسجلة" detail="سجّل سلفة ليُخصم قسطها تلقائياً من مسير الرواتب الشهري" />
        ) : (
          loans.map((loan) => {
            const remaining = Math.max(0, Number(loan.total_amount) - Number(loan.paid_amount));
            const progress = Math.min(100, Math.round((Number(loan.paid_amount) / Number(loan.total_amount)) * 100));
            return (
              <div key={loan.id} className="space-y-3 rounded-2xl border border-border bg-card p-4 shadow-glass">
                <div className="flex items-center gap-3">
                  <span className="flex size-10 shrink-0 items-center justify-center rounded-full bg-primary/10 text-primary">
                    <Banknote className="h-5 w-5" aria-hidden />
                  </span>
                  <span className="min-w-0 flex-1">
                    <span className="block truncate text-sm font-bold text-foreground">{employeeById.get(loan.employee_id)?.full_name ?? "موظف"}</span>
                    <span className="block text-xs text-muted-foreground">
                      قسط شهري {money(Number(loan.monthly_installment))} — من {monthLabel(loan.start_month)}
                    </span>
                  </span>
                  <span
                    className={cn(
                      "rounded-full px-3 py-1 text-[11px] font-bold",
                      loan.status === "closed" ? "bg-success/12 text-success" : "bg-warning/20 text-warning-foreground",
                    )}
                  >
                    {loan.status === "closed" ? "مسددة" : "قائمة"}
                  </span>
                </div>
                <div className="h-2 w-full overflow-hidden rounded-full bg-muted">
                  <div className="h-full rounded-full bg-primary" style={{ width: `${progress}%` }} />
                </div>
                <div className="flex flex-wrap items-center justify-between gap-2 text-xs text-muted-foreground">
                  <span>الإجمالي {money(Number(loan.total_amount))}</span>
                  <span>المسدد {money(Number(loan.paid_amount))}</span>
                  <span className="font-bold text-foreground">المتبقي {money(remaining)}</span>
                  {loan.status === "active" ? (
                    <Button type="button" variant="outline" size="sm" className="rounded-lg" onClick={() => void payInstallment(loan)}>
                      تسجيل سداد قسط
                    </Button>
                  ) : null}
                </div>
              </div>
            );
          })
        )}
      </div>
    </section>
  );
}

function KpiCard({
  icon,
  title,
  value,
  tone,
  badgeClass,
}: {
  icon: ReactNode;
  title: string;
  value: string;
  tone: string;
  badgeClass?: string;
}) {
  return (
    <div className="rounded-2xl border border-border/40 bg-card/75 px-3 py-2 shadow-glass backdrop-blur-sm">
      <div className="flex items-center gap-2">
        <span className={cn("flex size-6 shrink-0 items-center justify-center rounded-full bg-muted [&_svg]:size-3.5", tone)}>{icon}</span>
        <p className="truncate text-[11px] font-normal leading-tight text-muted-foreground">{title}</p>
      </div>
      {badgeClass ? (
        <span className={cn("mt-1 inline-block rounded-full px-2 py-0.5 text-[11px] font-medium", badgeClass)}>{value}</span>
      ) : (
        <p className={cn("mt-1 truncate text-sm font-medium leading-tight", tone)}>{value}</p>
      )}
    </div>
  );
}

function MiniStat({ label, value, className }: { label: string; value: string; className?: string }) {
  return (
    <div>
      <dt className="text-[11px] text-muted-foreground">{label}</dt>
      <dd className={cn("mt-0.5 font-bold text-foreground", className)}>{value}</dd>
    </div>
  );
}

function PayslipLine({ label, value }: { label: string; value: string }) {
  return (
    <div className="flex items-center justify-between border-b border-border/60 py-1.5 text-[12px] last:border-0">
      <span className="text-muted-foreground">{label}</span>
      <span className="font-bold text-foreground">{value}</span>
    </div>
  );
}

function MoneyField({ name, label, defaultValue }: { name: string; label: string; defaultValue: number }) {
  return (
    <label className="block space-y-1.5 text-sm">
      <span className="block font-bold text-foreground">{label}</span>
      <Input name={name} defaultValue={String(Number(defaultValue))} inputMode="decimal" dir="ltr" className="h-11 rounded-xl text-left" />
    </label>
  );
}

function FieldSelect({
  label,
  value,
  onChange,
  placeholder,
  children,
}: {
  label: string;
  value: string;
  onChange: (value: string) => void;
  placeholder: string;
  children: ReactNode;
}) {
  return (
    <div className="space-y-1.5 text-sm">
      <span className="block font-bold text-foreground">{label}</span>
      <Select value={value} onValueChange={onChange}>
        <SelectTrigger className="h-11 w-full rounded-xl">
          <SelectValue placeholder={placeholder} />
        </SelectTrigger>
        <SelectContent className="z-[200]">
          {children}
        </SelectContent>
      </Select>
    </div>
  );
}

function EmptyState({ title, detail }: { title: string; detail: string }) {
  return (
    <div className="rounded-2xl border border-dashed border-border bg-card p-8 text-center shadow-glass">
      <span className="mx-auto flex size-12 items-center justify-center rounded-full bg-muted text-muted-foreground">
        <Wallet className="h-6 w-6" aria-hidden />
      </span>
      <p className="mt-3 text-sm font-bold text-foreground">{title}</p>
      <p className="mt-1 text-xs leading-[1.8] text-muted-foreground">{detail}</p>
    </div>
  );
}
