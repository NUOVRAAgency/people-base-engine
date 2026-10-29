import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";

type Ctx = { supabase: any; userId: string };

async function assertAdmin(ctx: Ctx) {
  const { data } = await ctx.supabase.from("user_roles").select("role").eq("user_id", ctx.userId).eq("role", "admin");
  if (!data?.length) throw new Error("forbidden");
}

const r2 = (n: number) => Math.round(n * 100) / 100;

/**
 * Builds and posts a balanced payroll journal entry for one branch and month
 * from the APPROVED payroll rows. Reads payroll values only; never recalculates salaries.
 */
export const generatePayrollEntry = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: unknown) =>
    z.object({ month: z.string().regex(/^\d{4}-\d{2}-01$/), branchId: z.string().uuid() }).parse(d),
  )
  .handler(async ({ data, context }) => {
    const ctx = context as Ctx;
    await assertAdmin(ctx);
    const sb = ctx.supabase;

    const { data: existing } = await sb
      .from("payroll_journal_links").select("id")
      .eq("payroll_month", data.month).eq("branch_id", data.branchId).eq("is_reversed", false);
    if (existing?.length) return { ok: false as const, reason: "exists" };

    const { data: emps } = await sb.from("employees").select("id").eq("branch_id", data.branchId);
    const ids = (emps ?? []).map((e: { id: string }) => e.id);
    if (!ids.length) return { ok: false as const, reason: "no_payroll" };

    const { data: rows, error: pe } = await sb
      .from("payroll").select("*").eq("month", data.month).eq("status", "approved").in("employee_id", ids);
    if (pe) throw new Error(pe.message);
    if (!rows?.length) return { ok: false as const, reason: "no_payroll" };

    const s = (k: string) => r2(rows.reduce((a: number, r: any) => a + Number(r[k] ?? 0), 0));
    const amounts: Record<string, number> = {
      base_salary: s("base_salary"),
      housing_allowance: s("housing_allowance"),
      transport_allowance: s("transport_allowance"),
      overtime: s("overtime_amount"),
      bonuses: s("bonuses"),
      penalty_deduction: s("deductions"),
      net_payable: s("net_salary"),
    };
    const gross = amounts.base_salary + amounts.housing_allowance + amounts.transport_allowance + amounts.overtime + amounts.bonuses;
    // Whatever separates gross from net besides manual deductions is the absence deduction (computed by the payroll engine).
    const gap = r2(gross - amounts.net_payable - amounts.penalty_deduction);
    if (gap > 0) amounts.absence_deduction = gap;
    else if (gap < 0) amounts.other_additions = -gap;

    const { data: rules } = await sb.from("payroll_accounting_rules").select("rule_key,entry_side,account_id").eq("is_active", true);
    const ruleOf = new Map<string, { entry_side: string; account_id: string }>((rules ?? []).map((r: any) => [r.rule_key, r]));

    const lines: { account_id: string; debit: number; credit: number; memo: string; rule_key: string }[] = [];
    for (const [key, amount] of Object.entries(amounts)) {
      if (!(amount > 0)) continue;
      const rule = ruleOf.get(key);
      if (!rule) return { ok: false as const, reason: "missing_rule", rule: key };
      lines.push({
        account_id: rule.account_id,
        debit: rule.entry_side === "debit" ? amount : 0,
        credit: rule.entry_side === "credit" ? amount : 0,
        memo: key,
        rule_key: key,
      });
    }
    const td = r2(lines.reduce((a, l) => a + l.debit, 0));
    const tc = r2(lines.reduce((a, l) => a + l.credit, 0));
    if (td !== tc || td === 0) return { ok: false as const, reason: "unbalanced" };

    const { data: branch } = await sb.from("branches").select("name").eq("id", data.branchId).maybeSingle();
    const ym = data.month.slice(0, 7).replace("-", "");
    const entryNumber = `PR-${ym}-${data.branchId.slice(0, 6).toUpperCase()}`;

    const { data: entry, error: ee } = await sb.from("journal_entries").insert({
      entry_number: entryNumber,
      entry_date: data.month,
      branch_id: data.branchId,
      description: `قيد استحقاق رواتب شهر ${data.month.slice(0, 7)} - ${branch?.name ?? ""}`,
      source: "payroll",
      status: "draft",
      created_by: ctx.userId,
    }).select("id").single();
    if (ee) throw new Error(ee.message);

    const { error: le } = await sb.from("journal_entry_lines").insert(lines.map((l) => ({ ...l, journal_entry_id: entry.id })));
    if (le) {
      await sb.from("journal_entries").delete().eq("id", entry.id);
      throw new Error(le.message);
    }
    const { error: post } = await sb.from("journal_entries").update({ status: "posted" }).eq("id", entry.id);
    if (post) throw new Error(post.message);
    const { error: lk } = await sb.from("payroll_journal_links").insert({
      payroll_month: data.month, branch_id: data.branchId, journal_entry_id: entry.id, created_by: ctx.userId,
    });
    if (lk) throw new Error(lk.message);
    return { ok: true as const, entryNumber, total: td };
  });
