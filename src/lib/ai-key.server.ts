// Resolves the Gemini key: admin-saved value in app_secrets first, then env fallback.
export async function getGeminiKey(): Promise<string | undefined> {
  try {
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const { data } = await (supabaseAdmin as any).from("app_secrets").select("value").eq("id", "gemini_api_key").maybeSingle();
    if (data?.value) return data.value as string;
  } catch {
    /* fall back to env */
  }
  return process.env["GEMINI_API_KEY"] || undefined;
}
