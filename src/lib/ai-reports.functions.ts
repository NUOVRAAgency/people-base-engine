import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";

// النموذج المعتمد في استدعاءات Gemini (يُحدّث من مكان واحد فقط).
const GEMINI_MODELS = ["gemini-3.8-flash", "gemini-3.7-flash"];

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

/**
 * محادثة المساعد الذكي (Gemini) لمناقشة تقارير الشهر.
 * نفس القواعد الامنية: المفتاح يقرا على الخادم فقط، والاستدعاء للمدير فقط.
 */
export const chatWithAssistant = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input: unknown) =>
    z
      .object({
        context: z.string(),
        messages: z
          .array(z.object({ role: z.enum(["user", "assistant"]), text: z.string() }))
          .max(40),
      })
      .parse(input),
  )
  .handler(async ({ data, context }) => {
    const { data: role, error: roleError } = await context.supabase
      .from("user_roles")
      .select("role")
      .eq("user_id", context.userId)
      .eq("role", "admin")
      .maybeSingle();
    if (roleError || !role) {
      throw new Error("Forbidden: المساعد الذكي متاح للمدير فقط");
    }

    const apiKey = process.env["GEMINI_API_KEY"];
    if (!apiKey) {
      return {
        ready: false as const,
        message:
          "المحادثة جاهزة بالكامل وتنتظر فقط اضافة مفتاح Gemini في اسرار الخلفية، وبعدها تعمل الرسائل مباشرة.",
      };
    }

    const res = await callGemini(apiKey, {
      systemInstruction: {
        parts: [
          {
            text: `انت مساعد موارد بشرية عربي. اجب بلغة عربية بسيطة وبدون تشكيل وبجمل قصيرة. اعتمد على هذه البيانات:\n${data.context}`,
          },
        ],
      },
      contents: data.messages.map((item) => ({
        role: item.role === "user" ? "user" : "model",
        parts: [{ text: item.text }],
      })),
    });

    if (!res.ok) {
      return { ready: true as const, error: `Gemini error ${res.status}`, content: null };
    }

    const json = (await res.json()) as {
      candidates?: { content?: { parts?: { text?: string }[] } }[];
    };
    return {
      ready: true as const,
      error: null,
      content: json.candidates?.[0]?.content?.parts?.[0]?.text ?? "",
    };
  });
