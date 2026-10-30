import { createFileRoute } from "@tanstack/react-router";
import { LoaderCircle, Upload } from "lucide-react";
import { useEffect, useMemo, useState, type ChangeEvent } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { useCurrentUser } from "@/hooks/use-current-user";
import { supabase } from "@/integrations/supabase/client";
import { tr } from "@/lib/i18n";

export const Route = createFileRoute("/_authenticated/fingerprint-import")({
  head: () => ({
    meta: [
      { title: tr("استيراد البصمة | نظام الموارد البشرية") },
      { name: "description", content: tr("استيراد حركات بصمة ZKTeco ومعالجتها قبل الترحيل للحضور") },
      { property: "og:title", content: tr("استيراد البصمة | نظام الموارد البشرية") },
      { property: "og:description", content: tr("استيراد حركات بصمة ZKTeco ومعالجتها قبل الترحيل للحضور") },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary_large_image" },
    ],
  }),
  component: FingerprintImportPage,
});

type Emp = { id: string; employee_number: string; full_name: string };
type Row = { key: string; pin: string; date: string; check_in: string; check_out: string; employee_id: string | null; name: string; punches: number };

const toMin = (t: string) => {
  const [h, m] = t.split(":").map(Number);
  return (h || 0) * 60 + (m || 0);
};

/** Parses ZKTeco attlog (.dat, tab separated) or CSV: PIN, "YYYY-MM-DD HH:MM[:SS]". */
export function parseAttlog(text: string): Map<string, string[]> {
  const out = new Map<string, string[]>();
  for (const raw of text.split(/\r?\n/)) {
    const m = raw.match(/^\s*"?(\w+)"?\s*[\t,;]\s*"?(\d{4}-\d{2}-\d{2})[ T](\d{1,2}:\d{2})/);
    if (!m) continue;
    const key = `${m[1]}|${m[2]}`;
    const time = m[3].padStart(5, "0");
    const list = out.get(key) ?? [];
    list.push(time);
    out.set(key, list);
  }
  return out;
}

function FingerprintImportPage() {
  const { isAdmin, loading: roleLoading } = useCurrentUser();
  const [emps, setEmps] = useState<Emp[]>([]);
  const [settings, setSettings] = useState({ work_start: "08:00", grace_minutes: 0 });
  const [rows, setRows] = useState<Row[]>([]);
  const [saving, setSaving] = useState(false);
  const [msg, setMsg] = useState("");

  useEffect(() => {
    void Promise.all([
      supabase.from("employees").select("id,employee_number,full_name"),
      supabase.from("app_settings").select("work_start,grace_minutes").limit(1).maybeSingle(),
    ]).then(([e, s]) => {
      setEmps((e.data ?? []) as Emp[]);
      if (s.data) setSettings({ work_start: String(s.data.work_start).slice(0, 5), grace_minutes: s.data.grace_minutes });
    });
  }, []);

  const byPin = useMemo(() => {
    const m = new Map<string, Emp>();
    for (const e of emps) {
      m.set(e.employee_number, e);
      m.set(String(Number(e.employee_number.replace(/\D/g, "")) || e.employee_number), e);
    }
    return m;
  }, [emps]);

  async function onFile(ev: ChangeEvent<HTMLInputElement>) {
    const file = ev.target.files?.[0];
    if (!file) return;
    const groups = parseAttlog(await file.text());
    const list: Row[] = [];
    groups.forEach((times, key) => {
      const [pin, date] = key.split("|");
      times.sort();
      const emp = byPin.get(pin) ?? null;
      list.push({
        key, pin, date,
        check_in: times[0],
        check_out: times.length > 1 ? times[times.length - 1] : "",
        employee_id: emp?.id ?? null,
        name: emp?.full_name ?? "",
        punches: times.length,
      });
    });
    list.sort((a, b) => (a.date === b.date ? a.pin.localeCompare(b.pin) : a.date.localeCompare(b.date)));
    setRows(list);
    setMsg(`${tr("عدد الأيام المقروءة")}: ${list.length}`);
  }

  const late = (r: Row) => (r.check_in ? Math.max(0, toMin(r.check_in) - toMin(settings.work_start) - settings.grace_minutes) : 0);
  const update = (key: string, patch: Partial<Row>) => setRows((p) => p.map((r) => (r.key === key ? { ...r, ...patch } : r)));
  const matched = rows.filter((r) => r.employee_id);

  async function save() {
    setSaving(true);
    let ok = 0;
    const payload = matched.map((r) => {
      const l = late(r);
      return {
        employee_id: r.employee_id!,
        date: r.date,
        status: l > 0 ? "late" : "present",
        check_in: r.check_in || null,
        check_out: r.check_out || null,
        late_minutes: l,
        note: r.check_out ? null : tr("لا توجد بصمة انصراف"),
      };
    });
    for (let i = 0; i < payload.length; i += 200) {
      const { error } = await supabase.from("attendance").upsert(payload.slice(i, i + 200), { onConflict: "employee_id,date" });
      if (!error) ok += Math.min(200, payload.length - i);
    }
    setSaving(false);
    setMsg(`${tr("تم ترحيل")} ${ok} ${tr("من")} ${payload.length} ${tr("سجل إلى الحضور")}`);
  }

  if (roleLoading) return <LoaderCircle className="mx-auto mt-10 animate-spin" />;
  if (!isAdmin) return <p className="p-6 text-center text-muted-foreground">{tr("هذه الشاشة للمدير فقط")}</p>;

  return (
    <div className="space-y-4 p-4">
      <div className="rounded-2xl border bg-card p-4 space-y-3">
        <p className="text-sm text-muted-foreground">{tr("ارفع ملف البصمة من جهاز ZKTeco (attlog.dat) أو ملف CSV: رقم الموظف، التاريخ والوقت.")}</p>
        <label className="flex cursor-pointer items-center justify-center gap-2 rounded-xl border-2 border-dashed p-6 text-primary">
          <Upload className="size-5" />
          {tr("اختر ملف البصمة")}
          <input type="file" accept=".dat,.csv,.txt" className="hidden" onChange={onFile} />
        </label>
        {msg && <p className="text-sm font-medium">{msg}</p>}
        {rows.length > 0 && (
          <div className="flex flex-wrap items-center justify-between gap-2 text-sm">
            <span>{tr("مطابق")}: {matched.length} — {tr("غير مطابق")}: {rows.length - matched.length}</span>
            <Button onClick={save} disabled={saving || matched.length === 0}>
              {saving && <LoaderCircle className="animate-spin" />}
              {tr("اعتماد وترحيل للحضور")}
            </Button>
          </div>
        )}
      </div>

      {rows.length > 0 && (
        <div className="overflow-x-auto rounded-2xl border bg-card">
          <table className="w-full text-sm">
            <thead className="bg-muted text-muted-foreground">
              <tr>
                <th className="p-2 text-start">{tr("رقم البصمة")}</th>
                <th className="p-2 text-start">{tr("الموظف")}</th>
                <th className="p-2 text-start">{tr("التاريخ")}</th>
                <th className="p-2 text-start">{tr("الحضور")}</th>
                <th className="p-2 text-start">{tr("الانصراف")}</th>
                <th className="p-2 text-start">{tr("التأخير (دقيقة)")}</th>
              </tr>
            </thead>
            <tbody>
              {rows.slice(0, 500).map((r) => (
                <tr key={r.key} className={r.employee_id ? "border-t" : "border-t bg-destructive/10"}>
                  <td className="p-2">{r.pin}</td>
                  <td className="p-2">
                    <select
                      className="rounded-md border bg-background p-1"
                      value={r.employee_id ?? ""}
                      onChange={(e) => {
                        const emp = emps.find((x) => x.id === e.target.value);
                        update(r.key, { employee_id: emp?.id ?? null, name: emp?.full_name ?? "" });
                      }}
                    >
                      <option value="">{tr("غير مطابق")}</option>
                      {emps.map((e) => (
                        <option key={e.id} value={e.id}>{e.full_name}</option>
                      ))}
                    </select>
                  </td>
                  <td className="p-2 whitespace-nowrap">{r.date}</td>
                  <td className="p-2"><Input type="time" value={r.check_in} onChange={(e) => update(r.key, { check_in: e.target.value })} /></td>
                  <td className="p-2">
                    <Input type="time" value={r.check_out} onChange={(e) => update(r.key, { check_out: e.target.value })} className={r.check_out ? "" : "border-destructive"} />
                  </td>
                  <td className="p-2">{late(r)}</td>
                </tr>
              ))}
            </tbody>
          </table>
          {rows.length > 500 && <p className="p-2 text-xs text-muted-foreground">{tr("يُعرض أول 500 سجل للتعديل، ويُرحّل الكل.")}</p>}
        </div>
      )}
    </div>
  );
}
