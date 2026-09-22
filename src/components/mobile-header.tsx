import type { ReactNode } from "react";

/**
 * الهيدر العلوي للهاتف — ارتفاع ثابت 140px بعرض الشاشة كاملاً.
 * الخلفية: تدرج خطي من #0C4BBC (أعلى) إلى #0055FF (أسفل).
 */
export function MobileHeader({ children }: { children?: ReactNode }) {
  return (
    <header
      dir="rtl"
      className="w-full h-[140px] shrink-0 text-white"
      style={{
        background: "linear-gradient(180deg, #0C4BBC 0%, #0055FF 100%)",
      }}
    >
      {children}
    </header>
  );
}
