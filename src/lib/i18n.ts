import i18next from "i18next";
import { initReactI18next } from "react-i18next";
import en from "@/locales/en.json";

export type AppLanguage = "ar" | "en";
export const LANGUAGE_STORAGE_KEY = "hr-language";

function readStoredLanguage(): AppLanguage {
  if (typeof window === "undefined") return "ar";
  try {
    return window.localStorage.getItem(LANGUAGE_STORAGE_KEY) === "en" ? "en" : "ar";
  } catch {
    return "ar";
  }
}

// Arabic source strings are used as keys; the Arabic dictionary is the key itself.
i18next.use(initReactI18next).init({
  lng: readStoredLanguage(),
  fallbackLng: "ar",
  resources: { ar: { translation: {} }, en: { translation: en as Record<string, string> } },
  keySeparator: false,
  nsSeparator: false,
  returnEmptyString: false,
  interpolation: { escapeValue: false },
  react: { useSuspense: false },
});

export const i18n = i18next;

export function getLanguage(): AppLanguage {
  return i18next.language === "en" ? "en" : "ar";
}

export function getDirection(): "rtl" | "ltr" {
  return getLanguage() === "en" ? "ltr" : "rtl";
}

/** Locale for Intl formatters: Latin digits in both languages. */
export function getLocale(): string {
  return getLanguage() === "en" ? "en-US" : "ar-u-nu-latn";
}

/** Translate a fixed UI string (Arabic source text). User data must never pass through this. */
export function tr(text: string): string {
  if (getLanguage() !== "en") return text;
  return i18next.t(text, { defaultValue: text });
}

/** Persist and apply a language. Reloads so every screen re-renders in the new language/direction. */
export function setLanguage(lang: AppLanguage) {
  try {
    window.localStorage.setItem(LANGUAGE_STORAGE_KEY, lang);
  } catch {
    /* ignore */
  }
  window.location.reload();
}

/** Inline script that sets <html lang/dir> before first paint. */
export const LANGUAGE_BOOT_SCRIPT = `try{var l=localStorage.getItem("${LANGUAGE_STORAGE_KEY}")==="en"?"en":"ar";document.documentElement.lang=l;document.documentElement.dir=l==="en"?"ltr":"rtl";}catch(e){}`;

/** Translate a template with positional placeholders {0}, {1}... */
export function trf(template: string, ...values: unknown[]): string {
  return tr(template).replace(/\{(\d+)\}/g, (_, i) => String(values[Number(i)] ?? ""));
}

/** اسم الحساب المحاسبي حسب لغة الواجهة (يرجع للعربي إن لم يوجد اسم إنجليزي). */
export function accName(a: { name_ar?: string | null; name_en?: string | null } | null | undefined): string {
  if (!a) return "";
  return getLanguage() === "en" && a.name_en ? a.name_en : (a.name_ar ?? "");
}
