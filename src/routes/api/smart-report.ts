import { createFileRoute } from "@tanstack/react-router";
import { createClient } from "@supabase/supabase-js";

const SYSTEM_PROMPT =
  "انت محلل موارد بشرية محترف. اكتب تقريرا تحليليا موجزا ومباشرا في نقاط قصيرة (كل نقطة في سطر يبدأ بـ - ). بدون مقدمات او خاتمة، وبدون تشكيل، وركز على الارقام والاسباب والتوصيات العملية.";

// بث تقرير Gemini كلمة بكلمة. يتحقق من جلسة المستخدم ودوره (مدير) قبل الاستدعاء.
export const Route = createFileRoute("/api/smart-report")({
  server: {
    handlers: {
      POST: async ({ request }) => {
        const auth = request.headers.get("authorization") ?? "";
        const token = auth.replace(/^Bearer\s+/i, "");
        if (!token) return new Response("Unauthorized", { status: 401 });

        const supabase = createClient(process.env["SUPABASE_URL"]!, process.env["SUPABASE_PUBLISHABLE_KEY"]!, {
          global: { headers: { Authorization: `Bearer ${token}` } },
          auth: { persistSession: false, autoRefreshToken: false },
        });
        const { data: userData, error: userError } = await supabase.auth.getUser(token);
        if (userError || !userData.user) return new Response("Unauthorized", { status: 401 });
        const { data: role } = await supabase
          .from("user_roles")
          .select("role")
          .eq("user_id", userData.user.id)
          .eq("role", "admin")
          .maybeSingle();
        if (!role) return new Response("Forbidden", { status: 403 });

        let body: { month?: string; prompt?: string };
        try {
          body = await request.json();
        } catch {
          return new Response("Bad request", { status: 400 });
        }
        const month = typeof body.month === "string" && /^\d{4}-\d{2}-01$/.test(body.month) ? body.month : null;
        const prompt = typeof body.prompt === "string" ? body.prompt.slice(0, 8000) : "";
        if (!month || !prompt) return new Response("Bad request", { status: 400 });

        const apiKey = process.env["GEMINI_API_KEY"];
        if (!apiKey) return new Response("Not configured", { status: 503 });

        let upstream: Response | null = null;
        for (let attempt = 0; attempt < 4; attempt++) {
          upstream = await fetch(
            "https://generativelanguage.googleapis.com/v1beta/models/gemini-2.5-flash:streamGenerateContent?alt=sse",
            {
              method: "POST",
              headers: { "Content-Type": "application/json", "x-goog-api-key": apiKey },
              body: JSON.stringify({
                systemInstruction: { parts: [{ text: SYSTEM_PROMPT }] },
                contents: [{ role: "user", parts: [{ text: prompt }] }],
                generationConfig: { thinkingConfig: { thinkingBudget: 0 } },
              }),
            },
          );
          if (upstream.ok || (upstream.status !== 429 && upstream.status !== 503)) break;
          await new Promise((r) => setTimeout(r, 800));
        }
        if (!upstream || !upstream.ok || !upstream.body) {
          console.error("[smart-report] gemini status", upstream?.status);
          return new Response("Upstream error", { status: 502 });
        }

        const reader = upstream.body.getReader();
        const decoder = new TextDecoder();
        const encoder = new TextEncoder();
        let full = "";
        const stream = new ReadableStream<Uint8Array>({
          async start(controller) {
            let buffer = "";
            try {
              while (true) {
                const { done, value } = await reader.read();
                if (done) break;
                buffer += decoder.decode(value, { stream: true });
                const lines = buffer.split("\n");
                buffer = lines.pop() ?? "";
                for (const line of lines) {
                  if (!line.startsWith("data:")) continue;
                  try {
                    const json = JSON.parse(line.slice(5).trim()) as {
                      candidates?: { content?: { parts?: { text?: string }[] } }[];
                    };
                    const text = json.candidates?.[0]?.content?.parts?.map((p) => p.text ?? "").join("") ?? "";
                    if (text) {
                      full += text;
                      controller.enqueue(encoder.encode(text));
                    }
                  } catch {
                    /* ignore partial line */
                  }
                }
              }
              if (full) await supabase.from("reports").insert({ month, content: full });
            } finally {
              controller.close();
            }
          },
        });
        return new Response(stream, {
          headers: { "Content-Type": "text/plain; charset=utf-8", "Cache-Control": "no-cache" },
        });
      },
    },
  },
});
