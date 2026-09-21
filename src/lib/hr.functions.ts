import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";

const employeeMonth = z.object({
  employeeId: z.string().uuid(),
  month: z.string(), // YYYY-MM-DD (any day inside the month)
});

const netSalaryInput = employeeMonth.extend({
  bonuses: z.number().default(0),
  deductions: z.number().default(0),
});

/** صافي الراتب = الأساسي + البدلات - (أيام الغياب × الأساسي/30) - الخصومات */
export const getNetSalary = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input: unknown) => netSalaryInput.parse(input))
  .handler(async ({ data, context }) => {
    const { data: result, error } = await context.supabase.rpc("calculate_net_salary", {
      _employee_id: data.employeeId,
      _month: data.month,
      _bonuses: data.bonuses,
      _deductions: data.deductions,
    });
    if (error) throw new Error(error.message);
    return { netSalary: Number(result ?? 0) };
  });

/** نسبة الحضور الشهرية بالنسبة المئوية */
export const getMonthlyAttendanceRate = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input: unknown) => employeeMonth.parse(input))
  .handler(async ({ data, context }) => {
    const { data: result, error } = await context.supabase.rpc("monthly_attendance_rate", {
      _employee_id: data.employeeId,
      _month: data.month,
    });
    if (error) throw new Error(error.message);
    return { attendanceRate: Number(result ?? 0) };
  });

/** صلاحية المستخدم الحالي: admin أو viewer */
export const getMyRole = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }) => {
    const { data, error } = await context.supabase
      .from("user_roles")
      .select("role")
      .eq("user_id", context.userId);
    if (error) throw new Error(error.message);
    const roles = (data ?? []).map((r) => r.role);
    return { role: roles.includes("admin") ? "admin" : "viewer", roles };
  });
