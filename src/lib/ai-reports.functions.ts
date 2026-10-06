import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";

// النموذج المعتمد في استدعاءات Gemini (يُحدّث من مكان واحد فقط).
const GEMINI_MODELS = ["gemini-2.5-flash"];

async function callGemini(apiKey: string, body: unknown): Promise<Response> {
  let last: Response | null = null;
  for (const model of GEMINI_MODELS) {
    for (let attempt = 0; attempt < 2; attempt++) {
      const res = await fetch(
        `https://generativelanguage.googleapis.com/v1beta/models/${model}:generateContent`,
        {
          method: "POST",
          headers: { "Content-Type": "application/json", "x-goog-api-key": apiKey },
          body: JSON.stringify(body),
        },
      );
      if (res.ok) return res;
      const text = await res.clone().text();
      console.error(`[Gemini] model=${model} status=${res.status} body=${text}`);
      last = res;
      if (res.status !== 503 && res.status !== 429) break;
      await new Promise((r) => setTimeout(r, 800));
    }
  }
  return last!;
}

/**
 * وسيط الذكاء الاصطناعي (Gemini).
 *
 * قواعد أمنية:
 * - GEMINI_API_KEY يُقرأ داخل الـ handler من أسرار الخلفية فقط (Edge Function Secrets).
 * - لا يوجد أي متغير VITE_* للمفتاح، فلا تصل قيمته إلى المتصفح أو حزمة الواجهة إطلاقاً.
 * - الاستدعاء محصور بالمدير (admin) لأن التقارير قد تتضمن بيانات مالية.
 */
export const generateSmartReport = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input: unknown) =>
    z.object({ month: z.string(), prompt: z.string().optional() }).parse(input),
  )
  .handler(async ({ data, context }) => {
    const { data: role, error: roleError } = await context.supabase
      .from("user_roles")
      .select("role")
      .eq("user_id", context.userId)
      .eq("role", "admin")
      .maybeSingle();
    if (roleError || !role) {
      throw new Error("Forbidden: تقارير الذكاء الاصطناعي متاحة للمدير فقط");
    }

    // يُقرأ وقت التنفيذ على الخادم فقط — لا يُسرَّب في أي استجابة.
    const apiKey = process.env["GEMINI_API_KEY"];
    if (!apiKey) {
      return {
        ready: false as const,
        message:
          "GEMINI_API_KEY غير مضاف بعد في أسرار الخلفية. البنية جاهزة لاستقباله دون أي تعديل على الشفرة.",
      };
    }

    const res = await callGemini(apiKey, {
      contents: [
        {
          parts: [
            {
              text:
                data.prompt ??
                `اكتب تقريرًا موجزًا عن أداء الموارد البشرية لشهر ${data.month}.`,
            },
          ],
        },
      ],
    });

    if (!res.ok) {
      // لا نمرر نص الخطأ الخام حتى لا تتسرب أي تفاصيل عن المفتاح.
      return { ready: true as const, error: `Gemini error ${res.status}`, content: null };
    }

    const json = (await res.json()) as {
      candidates?: { content?: { parts?: { text?: string }[] } }[];
    };
    const content = json.candidates?.[0]?.content?.parts?.[0]?.text ?? "";

    await context.supabase.from("reports").insert({ month: data.month, content });

    return { ready: true as const, content };
  });

const SALARY_TERMS = /(راتب|رواتب|الراتب|أجر|اجر|اجور|أجور|مسير|سلف|سلفة|خصم|خصومات|بدل|مكافأ|salary|salaries|payroll|wage|pay\b|loan|bonus|deduction)/i;
const REFUSE_SALARY = "عذرا، بيانات الرواتب متاحة لمدير النظام فقط.";
const REFUSE_BRANCH = "عذرا، يمكنني الاجابة عن بيانات فرعك فقط.";

type Ctx = { supabase: any; userId: string };

/** Builds a 12-month summary using ONLY the caller's own session (RLS applies). */
async function buildYearContext({ supabase, userId }: Ctx, endMonth: string, isAdmin: boolean) {
  const end = new Date(`${endMonth}T00:00:00Z`);
  const start = new Date(Date.UTC(end.getUTCFullYear(), end.getUTCMonth() - 11, 1));
  const last = new Date(Date.UTC(end.getUTCFullYear(), end.getUTCMonth() + 1, 0));
  const from = start.toISOString().slice(0, 10);
  const to = last.toISOString().slice(0, 10);

  const [emp, att, lv, me, br, pay] = await Promise.all([
    supabase.from("employees").select("id,department,status,branch_id"),
    supabase.from("attendance").select("date,status,late_minutes").gte("date", from).lte("date", to),
    supabase.from("leave_requests").select("start_date,status").gte("start_date", from).lte("start_date", to),
    supabase.from("users").select("branch_id").eq("id", userId).maybeSingle(),
    supabase.from("branches").select("id,name"),
    isAdmin
      ? supabase.from("payroll").select("month,net_salary,deductions").gte("month", from).lte("month", to)
      : Promise.resolve({ data: [] }),
  ]);
  const employees = (emp.data ?? []) as { department: string | null; status: string }[];
  const months: Record<string, { present: number; late: number; absent: number; lateMin: number; leaves: number; approved: number; net: number; ded: number }> = {};
  for (let i = 0; i < 12; i++) {
    const d = new Date(Date.UTC(start.getUTCFullYear(), start.getUTCMonth() + i, 1));
    months[d.toISOString().slice(0, 7)] = { present: 0, late: 0, absent: 0, lateMin: 0, leaves: 0, approved: 0, net: 0, ded: 0 };
  }
  for (const r of (att.data ?? []) as { date: string; status: string; late_minutes: number }[]) {
    const m = months[r.date.slice(0, 7)]; if (!m) continue;
    if (r.status === "present") m.present++;
    if (r.status === "late") { m.late++; m.lateMin += Number(r.late_minutes || 0); }
    if (r.status === "absent") m.absent++;
  }
  for (const r of (lv.data ?? []) as { start_date: string; status: string }[]) {
    const m = months[r.start_date.slice(0, 7)]; if (!m) continue;
    m.leaves++; if (r.status === "approved") m.approved++;
  }
  for (const r of (pay.data ?? []) as { month: string; net_salary: number; deductions: number }[]) {
    const m = months[r.month.slice(0, 7)]; if (!m) continue;
    m.net += Number(r.net_salary); m.ded += Number(r.deductions);
  }
  const branches = (br.data ?? []) as { id: string; name: string }[];
  const myBranch = branches.find((b) => b.id === me.data?.branch_id)?.name ?? "";
  const scope = isAdmin ? "كل الفروع" : `فرع ${myBranch || "المستخدم"} فقط`;
  const lines = Object.entries(months).map(([k, m]) =>
    `${k}: حضور ${m.present}, تاخير ${m.late} (${m.lateMin} دقيقة), غياب ${m.absent}, طلبات اجازة ${m.leaves} (معتمدة ${m.approved})` +
    (isAdmin ? `, صافي الرواتب ${Math.round(m.net)}, الخصومات ${Math.round(m.ded)}` : ""),
  );
  const depts = [...new Set(employees.map((e) => e.department ?? "بدون قسم"))].join(", ") || "لا يوجد";
  const text = [
    `نطاق البيانات: ${scope}. الفترة: من ${from} الى ${to} (12 شهرا، اخرها الشهر المختار ${endMonth.slice(0, 7)}).`,
    `عدد الموظفين: ${employees.length}، النشطون: ${employees.filter((e) => e.status === "active").length}. الاقسام: ${depts}.`,
    ...lines,
  ].join("\n");
  const otherBranches = isAdmin ? [] : branches.filter((b) => b.id !== me.data?.branch_id).map((b) => b.name).filter(Boolean);
  return { text, otherBranches };
}

/**
 * محادثة المساعد الذكي لكل الادوار.
 * البيانات تجمع على الخادم بجلسة المستخدم نفسه (RLS)، لا بصلاحية الخدمة، ولا ترسل من المتصفح.
 * غير المدير: فرعه فقط وبدون رواتب، والرفض يحدث قبل استدعاء النموذج.
 */
export const chatWithAssistant = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input: unknown) =>
    z
      .object({
        month: z.string().regex(/^\d{4}-\d{2}-01$/),
        language: z.enum(["ar", "en"]).default("ar"),
        messages: z
          .array(z.object({ role: z.enum(["user", "assistant"]), text: z.string().max(2000) }))
          .min(1)
          .max(40),
      })
      .parse(input),
  )
  .handler(async ({ data, context }) => {
    const { data: roleRow } = await context.supabase
      .from("user_roles")
      .select("role")
      .eq("user_id", context.userId)
      .eq("role", "admin")
      .maybeSingle();
    const isAdmin = !!roleRow;
    const en = data.language === "en";
    const question = data.messages[data.messages.length - 1]!.text;

    if (!isAdmin && SALARY_TERMS.test(question)) {
      return { ready: true as const, error: null, refused: "salary" as const, content: en ? "Sorry, payroll data is available to the system admin only." : REFUSE_SALARY };
    }
    const { text, otherBranches } = await buildYearContext({ supabase: context.supabase, userId: context.userId }, data.month, isAdmin);
    if (!isAdmin && otherBranches.some((name) => name.length > 1 && question.includes(name))) {
      return { ready: true as const, error: null, refused: "branch" as const, content: en ? "Sorry, I can only answer about your own branch." : REFUSE_BRANCH };
    }

    const apiKey = process.env["GEMINI_API_KEY"];
    if (!apiKey) {
      return { ready: false as const, message: "تعذر الحصول على رد الان. حاول مرة اخرى بعد قليل." };
    }

    const rules = isAdmin
      ? ""
      : "\nقواعد صارمة: المستخدم ليس مديرا. لا تذكر اي رواتب او خصومات مالية او سلف، ولا تجب عن فروع اخرى. اذا سئلت عنها فاعتذر باختصار.";
    const res = await callGemini(apiKey, {
      systemInstruction: {
        parts: [{ text: `انت مساعد موارد بشرية. ${en ? "Answer in clear, short English." : "اجب بلغة عربية بسيطة وبدون تشكيل وبجمل قصيرة."} اعتمد فقط على هذه البيانات:\n${text}${rules}` }],
      },
      contents: data.messages.map((item) => ({ role: item.role === "user" ? "user" : "model", parts: [{ text: item.text }] })),
    });
    if (!res.ok) return { ready: true as const, error: `Gemini error ${res.status}`, refused: null, content: null };
    const json = (await res.json()) as { candidates?: { content?: { parts?: { text?: string }[] } }[] };
    return { ready: true as const, error: null, refused: null, content: json.candidates?.[0]?.content?.parts?.[0]?.text ?? "" };
  });
