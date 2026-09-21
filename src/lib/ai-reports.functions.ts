import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";

/**
 * هيكل جاهز لتوليد التقارير الذكية عبر Gemini.
 * لا يعمل فعليًا حتى تتم إضافة المفتاح GEMINI_API_KEY لاحقًا.
 */
export const generateSmartReport = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input: unknown) =>
    z.object({ month: z.string(), prompt: z.string().optional() }).parse(input),
  )
  .handler(async ({ data, context }) => {
    const apiKey = process.env["GEMINI_API_KEY"];
    if (!apiKey) {
      return {
        ready: false as const,
        message: "GEMINI_API_KEY غير مضاف بعد. الهيكل جاهز لاستقبال المفتاح لاحقًا.",
      };
    }

    // نقطة الاتصال الجاهزة — تُفعَّل عند إضافة المفتاح.
    const res = await fetch(
      `https://generativelanguage.googleapis.com/v1beta/models/gemini-2.5-flash:generateContent?key=${apiKey}`,
      {
        method: "POST",
        headers: { "Content-Type": "application/json" },
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
      return { ready: true as const, error: `Gemini error ${res.status}`, content: null };
    }

    const json = (await res.json()) as {
      candidates?: { content?: { parts?: { text?: string }[] } }[];
    };
    const content = json.candidates?.[0]?.content?.parts?.[0]?.text ?? "";

    await context.supabase.from("reports").insert({ month: data.month, content });

    return { ready: true as const, content };
  });
