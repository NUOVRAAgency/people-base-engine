import { useState } from "react";
import { useServerFn } from "@tanstack/react-start";
import { KeyRound, LoaderCircle, Lock, Save, Trash2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { unlockAiKey, saveAiKey } from "@/lib/ai-key.functions";
import { tr } from "@/lib/i18n";

const REASONS: Record<string, string> = {
  forbidden: "هذا الإعداد لمدير النظام فقط",
  bad_password: "كلمة المرور غير صحيحة",
  format: "المفتاح ناقص أو بصيغة خاطئة (يبدأ بـ AIza)",
  invalid: "المفتاح غير صالح أو مرفوض من Google، لم يُحفظ",
  save: "تعذر حفظ المفتاح، حاول مرة أخرى",
};

export function AiKeyCard() {
  const unlock = useServerFn(unlockAiKey);
  const save = useServerFn(saveAiKey);
  const [password, setPassword] = useState("");
  const [unlocked, setUnlocked] = useState(false);
  const [hasKey, setHasKey] = useState(false);
  const [newKey, setNewKey] = useState("");
  const [confirm, setConfirm] = useState(false);
  const [busy, setBusy] = useState(false);
  const [msg, setMsg] = useState<{ ok: boolean; text: string } | null>(null);

  async function doUnlock() {
    if (!password) return setMsg({ ok: false, text: tr("أدخل كلمة المرور") });
    setBusy(true); setMsg(null);
    try {
      const r = await unlock({ data: { password } });
      if (!r.ok) setMsg({ ok: false, text: tr(REASONS[r.reason] ?? "خطأ") });
      else { setUnlocked(true); setHasKey(r.hasKey); }
    } catch { setMsg({ ok: false, text: tr("تعذر التحقق، حاول مرة أخرى") }); }
    setBusy(false);
  }

  async function doSave() {
    if (!newKey.trim()) return setMsg({ ok: false, text: tr("الحقل فارغ، الصق المفتاح الجديد") });
    if (!confirm) return setMsg({ ok: false, text: tr("أكّد موافقتك على استبدال المفتاح أولاً") });
    setBusy(true); setMsg(null);
    try {
      const r = await save({ data: { password, apiKey: newKey } });
      if (!r.ok) setMsg({ ok: false, text: tr(REASONS[r.reason] ?? "خطأ") });
      else { setMsg({ ok: true, text: tr("تم التحقق من المفتاح وحفظه، المساعد يعمل به الآن") }); setNewKey(""); setConfirm(false); setHasKey(true); }
    } catch { setMsg({ ok: false, text: tr("تعذر الحفظ، حاول مرة أخرى") }); }
    setBusy(false);
  }

  function lock() { setUnlocked(false); setPassword(""); setNewKey(""); setConfirm(false); setMsg(null); }

  return (
    <section className="rounded-2xl border border-border/50 bg-card/75 p-4 shadow-glass backdrop-blur-sm">
      <h2 className="flex items-center gap-2 text-base font-medium text-foreground">
        <KeyRound className="h-4 w-4 text-primary" aria-hidden />
        {tr("مفتاح الذكاء الاصطناعي (Google AI Studio)")}
      </h2>
      {!unlocked ? (
        <div className="mt-3 space-y-2">
          <p className="text-xs text-muted-foreground">{tr("أدخل كلمة مرور دخولك لفتح هذا الإعداد")}</p>
          <Input type="password" dir="ltr" value={password} onChange={(e) => setPassword(e.target.value)} onKeyDown={(e) => e.key === "Enter" && void doUnlock()} placeholder="••••••••" className="h-11 rounded-xl" autoComplete="current-password" />
          <Button type="button" className="h-11 w-full rounded-xl" disabled={busy} onClick={() => void doUnlock()}>
            {busy ? <LoaderCircle className="h-4 w-4 animate-spin" /> : <Lock className="h-4 w-4" />}
            {tr("فتح")}
          </Button>
        </div>
      ) : (
        <div className="mt-3 space-y-3">
          <p className="text-sm text-foreground">
            {tr("المفتاح الحالي")}: <span dir="ltr">{hasKey ? "••••••••••••" : tr("غير موجود")}</span>
          </p>
          <Input type="password" dir="ltr" value={newKey} onChange={(e) => { setNewKey(e.target.value); setMsg(null); }} placeholder="AIza..." className="h-11 rounded-xl" autoComplete="off" />
          {newKey && (
            <Button type="button" variant="outline" className="h-9 rounded-xl text-xs" onClick={() => setNewKey("")}>
              <Trash2 className="h-3.5 w-3.5" /> {tr("مسح الحقل")}
            </Button>
          )}
          <label className="flex items-center gap-2 text-sm">
            <input type="checkbox" checked={confirm} onChange={(e) => setConfirm(e.target.checked)} className="h-4 w-4" />
            {tr("أوافق على حذف المفتاح القديم واستبداله بهذا المفتاح")}
          </label>
          <div className="flex gap-2">
            <Button type="button" className="h-11 flex-1 rounded-xl" disabled={busy} onClick={() => void doSave()}>
              {busy ? <LoaderCircle className="h-4 w-4 animate-spin" /> : <Save className="h-4 w-4" />}
              {tr("حفظ")}
            </Button>
            <Button type="button" variant="outline" className="h-11 rounded-xl" onClick={lock}>{tr("قفل")}</Button>
          </div>
        </div>
      )}
      {msg && <p className={msg.ok ? "mt-3 text-sm text-primary" : "mt-3 text-sm text-destructive"}>{msg.text}</p>}
    </section>
  );
}
