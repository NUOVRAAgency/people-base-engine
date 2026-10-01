import { supabase } from "@/integrations/supabase/client";
import { getLanguage } from "@/lib/i18n";

export type CurrencyCode = "YER" | "SAR" | "USD";
const AR_LABEL: Record<CurrencyCode, string> = { YER: "ر.ي", SAR: "ر.س", USD: "دولار" };
const KEY = "hr-currency";

let current: CurrencyCode = "YER";
if (typeof window !== "undefined") {
  try {
    const v = localStorage.getItem(KEY);
    if (v === "SAR" || v === "USD" || v === "YER") current = v;
  } catch {
    /* ignore */
  }
}

/** Loads the organisation's chosen currency (display only — never used in calculations). */
export async function loadCurrency() {
  const { data } = await supabase.from("app_settings").select("currency").eq("id", "organization").maybeSingle();
  const v = data?.currency;
  if (v === "SAR" || v === "USD" || v === "YER") {
    current = v;
    try {
      localStorage.setItem(KEY, v);
    } catch {
      /* ignore */
    }
  }
}

/** Currency label in the active language: Arabic symbol (ر.ي) or English code (YER). */
export function currencyLabel(code: CurrencyCode = current) {
  return getLanguage() === "en" ? code : AR_LABEL[code];
}

/** "1,200 ر.ي" / "1,200 YER" — `formatted` is an already-formatted number. */
export function withCurrency(formatted: string) {
  return `${formatted} ${currencyLabel()}`;
}
