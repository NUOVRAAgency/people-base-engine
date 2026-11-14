import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import { createClient } from "@supabase/supabase-js";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";

async function assertAdminWithPassword(ctx: { supabase: any; userId: string; claims: any }, password: string) {
  const { data: role } = await ctx.supabase.from("user_roles").select("role").eq("user_id", ctx.userId).eq("role", "admin").maybeSingle();
  if (!role) return "forbidden";
  const email = ctx.claims?.email as string | undefined;
  if (!email) return "forbidden";
  const key = process.env["SUPABASE_PUBLISHABLE_KEY"]!;
  const client = createClient(process.env["SUPABASE_URL"]!, key, {
    auth: { persistSession: false, autoRefreshToken: false },
    global: {
      fetch: (input, init) => {
        const h = new Headers(init?.headers);
        if (key.startsWith("sb_") && h.get("Authorization") === `Bearer ${key}`) h.delete("Authorization");
        h.set("apikey", key);
        return fetch(input, { ...init, headers: h });
      },
    },
  });
  const { error } = await client.auth.signInWithPassword({ email, password });
  return error ? "bad_password" : "ok";
}

export const unlockAiKey = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((i: unknown) => z.object({ password: z.string().min(1).max(200) }).parse(i))
  .handler(async ({ data, context }) => {
    const r = await assertAdminWithPassword(context as any, data.password);
    if (r !== "ok") return { ok: false as const, reason: r };
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const { data: row } = await (supabaseAdmin as any).from("app_secrets").select("updated_at").eq("id", "gemini_api_key").maybeSingle();
    return { ok: true as const, hasKey: !!row || !!process.env["GEMINI_API_KEY"], updatedAt: (row?.updated_at as string) ?? null };
  });

export const saveAiKey = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((i: unknown) => z.object({ password: z.string().min(1).max(200), apiKey: z.string().max(300) }).parse(i))
  .handler(async ({ data, context }) => {
    const r = await assertAdminWithPassword(context as any, data.password);
    if (r !== "ok") return { ok: false as const, reason: r };
    const apiKey = data.apiKey.trim();
    if (!/^(AIza[0-9A-Za-z_-]{30,}|AQ\.[0-9A-Za-z._-]{30,})$/.test(apiKey)) return { ok: false as const, reason: "format" };
    const test = await fetch("https://generativelanguage.googleapis.com/v1beta/models?pageSize=1", { headers: { "x-goog-api-key": apiKey } });
    if (!test.ok) return { ok: false as const, reason: "invalid" };
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const { error } = await (supabaseAdmin as any)
      .from("app_secrets")
      .upsert({ id: "gemini_api_key", value: apiKey, updated_by: context.userId, updated_at: new Date().toISOString() });
    if (error) return { ok: false as const, reason: "save" };
    return { ok: true as const };
  });
