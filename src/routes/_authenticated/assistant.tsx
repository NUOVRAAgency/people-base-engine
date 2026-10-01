import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { useServerFn } from "@tanstack/react-start";
import { LoaderCircle, Mic, Send, X } from "lucide-react";
import { useCallback, useEffect, useMemo, useRef, useState, type FormEvent } from "react";
import { Button } from "@/components/ui/button";
import { useCurrentUser } from "@/hooks/use-current-user";
import { supabase } from "@/integrations/supabase/client";
import { chatWithAssistant } from "@/lib/ai-reports.functions";
import { cn } from "@/lib/utils";

import { getLanguage, tr, trf, getLocale } from "@/lib/i18n";
export const Route = createFileRoute("/_authenticated/assistant")({
  validateSearch: (search: Record<string, unknown>) => ({
    month: typeof search["month"] === "string" ? (search["month"] as string) : undefined,
  }),
  head: () => ({
    meta: [
      { title: tr("المساعد الذكي | نظام الموارد البشرية") },
      { name: "description", content: tr("محادثة نصية وصوتية مع مساعد الموارد البشرية الذكي") },
      { property: "og:title", content: tr("المساعد الذكي | نظام الموارد البشرية") },
      { property: "og:description", content: tr("محادثة نصية وصوتية مع مساعد الموارد البشرية الذكي") },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary_large_image" },
    ],
  }),
  component: AssistantPage,
});

type ChatMessage = { id: string; role: "user" | "assistant"; text: string; at: string };

const timeFormatter = new Intl.DateTimeFormat(getLocale(), { hour: "2-digit", minute: "2-digit" });
const monthFormatter = new Intl.DateTimeFormat(getLocale(), { month: "long", year: "numeric" });

function monthKey(date: Date) {
  return `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, "0")}-01`;
}

function monthBounds(key: string) {
  const start = new Date(`${key}T00:00:00`);
  const end = new Date(start.getFullYear(), start.getMonth() + 1, 0);
  const pad = (value: number) => String(value).padStart(2, "0");
  return {
    from: `${start.getFullYear()}-${pad(start.getMonth() + 1)}-01`,
    to: `${end.getFullYear()}-${pad(end.getMonth() + 1)}-${pad(end.getDate())}`,
  };
}

const SUGGESTIONS = [
  tr("لخص لي اداء هذا الشهر"),
  tr("لخص لي الشهر السابق"),
  tr("قارن هذا الشهر بالشهر السابق"),
];


function AssistantPage() {
  const navigate = useNavigate();
  const { month: monthParam } = Route.useSearch();
  const { isAdmin, loading: roleLoading } = useCurrentUser();
  const month = monthParam ?? monthKey(new Date());
  const runChat = useServerFn(chatWithAssistant);

  const [messages, setMessages] = useState<ChatMessage[]>([
    {
      id: "welcome",
      role: "assistant",
      text: tr("اهلا بك. اسالني عن الحضور او الاجازات او الموظفين خلال اخر 12 شهرا وسالخص لك الصورة."),
      at: new Date().toISOString(),
    },
  ]);
  const [draft, setDraft] = useState("");
  const [busy, setBusy] = useState(false);
  const [notice, setNotice] = useState("");
  const [listening, setListening] = useState(false);
  const endRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLInputElement>(null);
  const recognitionRef = useRef<{ stop: () => void } | null>(null);

  useEffect(() => {
    endRef.current?.scrollIntoView({ behavior: "smooth", block: "end" });
  }, [messages, busy]);

  useEffect(() => {
    inputRef.current?.focus();
  }, []);

  const send = useCallback(
    async (text: string) => {
      const value = text.trim();
      if (!value || busy) return;
      setNotice("");
      const outgoing: ChatMessage = { id: `${Date.now()}`, role: "user", text: value, at: new Date().toISOString() };
      const history = [...messages.filter((item) => item.id !== "welcome"), outgoing];
      setMessages((current) => [...current, outgoing]);
      setDraft("");
      setBusy(true);
      try {
        const result = await runChat({
          data: {
            month,
            language: getLanguage(),
            messages: history.slice(-20).map((item) => ({ role: item.role, text: item.text })),
          },
        });
        if (!result.ready) {
          setNotice(result.message);
          return;
        }
        if (result.error || !result.content) {
          setNotice(tr("تعذر الحصول على رد الان. حاول مرة اخرى بعد قليل."));
          return;
        }
        setMessages((current) => [
          ...current,
          { id: `${Date.now()}-a`, role: "assistant", text: result.content ?? "", at: new Date().toISOString() },
        ]);
      } catch {
        setNotice(tr("تعذر الاتصال بالمساعد الذكي."));
      } finally {
        setBusy(false);
        inputRef.current?.focus();
      }
    },
    [busy, messages, month, runChat],
  );

  const speechSupported = useMemo(() => {
    if (typeof window === "undefined") return false;
    const w = window as unknown as Record<string, unknown>;
    return Boolean(w["SpeechRecognition"] ?? w["webkitSpeechRecognition"]);
  }, []);

  function toggleVoice() {
    if (listening) {
      recognitionRef.current?.stop();
      setListening(false);
      return;
    }
    const w = window as unknown as Record<string, unknown>;
    const Ctor = (w["SpeechRecognition"] ?? w["webkitSpeechRecognition"]) as
      | (new () => {
          lang: string;
          interimResults: boolean;
          continuous: boolean;
          start: () => void;
          stop: () => void;
          onresult: ((event: { results: ArrayLike<ArrayLike<{ transcript: string }>> }) => void) | null;
          onend: (() => void) | null;
          onerror: (() => void) | null;
        })
      | undefined;
    if (!Ctor) {
      setNotice(tr("التسجيل الصوتي غير مدعوم في هذا المتصفح."));
      return;
    }
    const recognition = new Ctor();
    recognition.lang = "ar-YE";
    recognition.interimResults = true;
    recognition.continuous = false;
    recognition.onresult = (event) => {
      let text = "";
      for (let index = 0; index < event.results.length; index += 1) {
        text += event.results[index]?.[0]?.transcript ?? "";
      }
      setDraft(text);
    };
    recognition.onend = () => setListening(false);
    recognition.onerror = () => {
      setListening(false);
      setNotice(tr("تعذر التقاط الصوت. تاكد من اذن الميكروفون."));
    };
    recognitionRef.current = recognition;
    recognition.start();
    setListening(true);
  }

  function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    void send(draft);
  }

  return (
    <div className="fixed inset-0 z-50 flex flex-col bg-background">
      <header className="shrink-0 bg-[linear-gradient(180deg,#0c4bbc_0%,#0f52d8_100%)] px-4 pb-2.5 pt-2.5 text-primary-foreground">
        <div className="mx-auto flex w-full max-w-4xl items-center gap-2.5">
          <button
            type="button"
            onClick={() => void navigate({ to: "/reports" })}
            aria-label={tr("اغلاق المحادثة")}
            className="flex size-8 shrink-0 items-center justify-center rounded-full bg-white text-[#0c4bbc] transition-transform active:scale-95"
          >
            <X className="h-4 w-4" aria-hidden />
          </button>
          <h1 className="min-w-0 truncate text-[15px] font-medium">{tr("المساعد الذكي")}</h1>
          <span className="shrink-0 rounded-full bg-white/15 px-2.5 py-0.5 text-[11px] font-medium">
            {monthFormatter.format(new Date(`${month}T00:00:00`))}
          </span>

        </div>
      </header>


      <div className="min-h-0 flex-1 overflow-y-auto px-4 py-4">
        <div className="mx-auto flex w-full max-w-3xl flex-col gap-2.5">

          {(

            <>
              <p className="text-center text-[12px] text-muted-foreground">
                {timeFormatter.format(new Date(messages[0]?.at ?? Date.now()))}
              </p>
              {messages.map((message) => (
                <div
                  key={message.id}
                  className={cn("flex w-full", message.role === "user" ? "justify-start" : "justify-end")}
                >
                  <div
                    className={cn(
                      "max-w-[85%] rounded-xl px-3.5 py-1.5 text-sm leading-[1.6] md:max-w-[70%]",
                      message.role === "user"
                        ? "bg-[#0c4bbc] text-primary-foreground"
                        : "bg-muted/70 text-foreground",
                    )}

                  >
                    <p className="whitespace-pre-wrap font-normal">{message.text}</p>
                  </div>
                </div>
              ))}

              {busy ? (
                <div className="flex justify-end">
                  <span className="flex items-center gap-2 rounded-2xl bg-muted/70 px-4 py-3 text-sm text-muted-foreground">
                    <LoaderCircle className="h-4 w-4 animate-spin" aria-hidden />
                    {tr("يكتب الان")}
                  </span>
                </div>
              ) : null}

              {messages.length === 1 && !busy ? (
                <div className="mt-2 flex flex-wrap justify-end gap-2">
                  {SUGGESTIONS.map((item) => (
                    <button
                      key={item}
                      type="button"
                      onClick={() => void send(item)}
                      className="rounded-full border border-border/60 bg-card/75 px-3 py-2 text-[12px] font-normal text-muted-foreground shadow-glass backdrop-blur-sm transition-colors hover:text-foreground"
                    >
                      {item}
                    </button>
                  ))}
                </div>
              ) : null}

              {notice ? (
                <p className="rounded-xl border border-border/60 bg-card/75 p-3 text-center text-[13px] leading-[1.8] text-muted-foreground shadow-glass backdrop-blur-sm">
                  {notice}
                </p>
              ) : null}
            </>
          )}
          <div ref={endRef} />
        </div>
      </div>

      <form onSubmit={submit} className="shrink-0 border-t border-border/60 bg-card/90 px-4 py-3 backdrop-blur-md">
        <div className="mx-auto flex w-full max-w-3xl items-center gap-2">
          <input
            ref={inputRef}
            value={draft}
            onChange={(event) => setDraft(event.target.value)}
            placeholder={tr("اكتب رسالتك")}
            className="h-12 min-w-0 flex-1 rounded-2xl bg-muted/50 px-4 text-sm text-foreground outline-none placeholder:text-muted-foreground focus:ring-2 focus:ring-primary/30"
          />
          {speechSupported ? (
            <Button
              type="button"
              variant="ghost"
              size="icon"
              onClick={toggleVoice}
              aria-label={listening ? tr("ايقاف التسجيل") : tr("تسجيل صوتي")}
              className={cn(
                "size-12 shrink-0 rounded-2xl",
                listening ? "bg-destructive/10 text-destructive" : "text-muted-foreground",
              )}
            >
              <Mic className="h-5 w-5" aria-hidden />
            </Button>
          ) : null}
          <Button
            type="submit"
            size="icon"
            disabled={busy || !draft.trim()}
            aria-label={tr("ارسال")}
            className="size-12 shrink-0 rounded-2xl shadow-[0_8px_18px_-8px_rgba(12,75,188,0.8)]"
          >
            <Send className="h-5 w-5" aria-hidden />
          </Button>
        </div>
        <p className="mx-auto mt-2 w-full max-w-3xl text-center text-[11px] text-muted-foreground">
          {listening ? tr("جاري الاستماع") : tr("الردود تعتمد على بيانات النظام لهذا الشهر")}
        </p>
      </form>
    </div>
  );
}
