import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";

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

    const res = await fetch(
      `https://generativelanguage.googleapis.com/v1beta/models/gemini-2.5-flash:generateContent`,
      {
        method: "POST",
        headers: { "Content-Type": "application/json", "x-goog-api-key": apiKey },
        body: JSON.stringify({
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
        }),
      },
    );

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
