import { createFileRoute } from "@tanstack/react-router";
import { CalendarDays, Check, LoaderCircle, Plus, UserRound, X } from "lucide-react";
import { useCallback, useEffect, useMemo, useState, type FormEvent, type ReactNode } from "react";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { GlassDatePicker } from "@/components/glass-date-picker";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { useCurrentUser } from "@/hooks/use-current-user";
import { supabase } from "@/integrations/supabase/client";
import { cn } from "@/lib/utils";

import { tr, trf, getLocale } from "@/lib/i18n";
export const Route = createFileRoute("/_authenticated/leaves")({
  head: () => ({
    meta: [
      { title: tr("الإجازات | نظام الموارد البشرية") },
      { name: "description", content: tr("طلبات الإجازات والموافقات") },
      { property: "og:title", content: tr("الإجازات | نظام الموارد البشرية") },
      { property: "og:description", content: tr("طلبات الإجازات والموافقات") },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary_large_image" },
    ],
  }),
  component: LeavesPage,
});

function LeavesPage() {
  const { role, isAdmin, loading: roleLoading } = useCurrentUser();
  const [requests, setRequests] = useState<LeaveRequest[]>([]);
  const [employees, setEmployees] = useState<Employee[]>([]);
  const [filter, setFilter] = useState<Filter>("all");
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [dialogOpen, setDialogOpen] = useState(false);
  const [saving, setSaving] = useState(false);
  const [actingId, setActingId] = useState("");
  const [feedback, setFeedback] = useState<{ kind: "success" | "error"; message: string } | null>(null);
  const [form, setForm] = useState({ employeeId: "", leaveType: "annual", leaveTypeOther: "", startDate: "", endDate: "" });

  const canCreate = role === "admin" || role === "operator";

  const loadData = useCallback(async () => {
    setLoading(true);
    setError("");
    const [requestsResult, employeesResult] = await Promise.all([
      supabase
        .from("leave_requests")
        .select("id,employee_id,leave_type,leave_type_other,start_date,end_date,status,created_at,employees(full_name)")
        .order("created_at", { ascending: false }),
      supabase.from("employees").select("id,full_name").eq("status", "active").order("full_name"),
    ]);
    if (requestsResult.error || employeesResult.error) {
      setError(tr("تعذّر تحميل طلبات الإجازة. حاول مرة أخرى."));
    } else {
      setRequests((requestsResult.data ?? []) as LeaveRequest[]);
      setEmployees(employeesResult.data ?? []);
    }
    setLoading(false);
  }, []);

  useEffect(() => {
    void loadData();
  }, [loadData]);

  const counts = useMemo(() => ({
    all: requests.length,
    pending: requests.filter((item) => item.status === "pending").length,
    approved: requests.filter((item) => item.status === "approved").length,
    rejected: requests.filter((item) => item.status === "rejected").length,
  }), [requests]);
  const visibleRequests = filter === "all" ? requests : requests.filter((item) => item.status === filter);

  async function submitRequest(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setFeedback(null);
    if (!form.employeeId || !form.startDate || !form.endDate) {
      setFeedback({ kind: "error", message: tr("أكمل جميع الحقول المطلوبة") });
      return;
    }
    if (form.leaveType === "other" && !form.leaveTypeOther.trim()) {
      setFeedback({ kind: "error", message: tr("اكتب اسم نوع الإجازة") });
      return;
    }
    if (form.endDate < form.startDate) {
      setFeedback({ kind: "error", message: tr("تاريخ النهاية يجب أن يكون بعد تاريخ البداية") });
      return;
    }
    setSaving(true);
    const { error: insertError } = await supabase.from("leave_requests").insert({
      employee_id: form.employeeId,
      leave_type: form.leaveType,
      leave_type_other: form.leaveType === "other" ? form.leaveTypeOther.trim() : null,
      start_date: form.startDate,
      end_date: form.endDate,
      status: "pending",
    });
    setSaving(false);
    if (insertError) {
      setFeedback({ kind: "error", message: tr("لم يتم حفظ الطلب. تحقق من صلاحيات الموظف المختار.") });
      return;
    }
    setDialogOpen(false);
    setForm({ employeeId: "", leaveType: "annual", leaveTypeOther: "", startDate: "", endDate: "" });
    setFeedback({ kind: "success", message: tr("تم إرسال طلب الإجازة") });
    window.dispatchEvent(new Event("hr-header-refresh"));
    await loadData();
  }

  async function updateStatus(id: string, status: "approved" | "rejected") {
    setFeedback(null);
    setActingId(id);
    const { error: updateError } = await supabase.from("leave_requests").update({ status }).eq("id", id);
    setActingId("");
    if (updateError) {
      setFeedback({ kind: "error", message: tr("تعذّر تحديث حالة الطلب") });
      return;
    }
    setFeedback({ kind: "success", message: status === "approved" ? tr("تم اعتماد الطلب") : tr("تم رفض الطلب") });
    window.dispatchEvent(new Event("hr-header-refresh"));
    await loadData();
  }

  return (
    <section className="mx-auto w-full max-w-xl space-y-4 font-sans text-foreground" aria-labelledby="leaves-heading">
      <div className="grid grid-cols-[minmax(0,1fr)_auto] items-center gap-3">
        <div className="min-w-0">
          <p className="text-xs font-normal text-muted-foreground">{tr("إدارة الطلبات")}</p>
          <h2 id="leaves-heading" className="truncate text-xl font-semibold leading-relaxed">{tr("إجازات الفريق")}</h2>
        </div>
        <div className="flex items-center gap-2">
        {canCreate ? (
          <Dialog open={dialogOpen} onOpenChange={setDialogOpen}>
            <DialogTrigger asChild>
              <Button aria-label={tr("إضافة طلب إجازة")} size="icon" className="min-h-11 min-w-11 rounded-full bg-primary text-primary-foreground shadow-nav hover:bg-primary/90">
                <Plus className="size-5" aria-hidden />
              </Button>
            </DialogTrigger>
            <DialogContent className="inset-x-3 bottom-3 top-auto w-auto max-w-none translate-x-0 translate-y-0 rounded-lg border-border bg-card p-5 font-sans text-foreground shadow-card sm:inset-x-auto sm:bottom-auto sm:left-1/2 sm:top-1/2 sm:w-[min(430px,calc(100vw-32px))] sm:-translate-x-1/2 sm:-translate-y-1/2">
              <DialogHeader className="text-start sm:text-start">
                <DialogTitle className="text-lg leading-relaxed">{tr("طلب إجازة جديد")}</DialogTitle>
                <DialogDescription className="text-muted-foreground">{tr("يُرسل الطلب بحالة معلّق للمراجعة.")}</DialogDescription>
              </DialogHeader>
              <form className="space-y-4" onSubmit={submitRequest}>
                <Field label={tr("الموظف")}>
                  <Select value={form.employeeId} onValueChange={(employeeId) => setForm((value) => ({ ...value, employeeId }))}>
                    <SelectTrigger className="h-11 border-input bg-background text-foreground focus:ring-ring">
                      <SelectValue placeholder={tr("اختر الموظف")} />
                    </SelectTrigger>
                    <SelectContent position="popper" className="z-[60] max-h-64 border-border bg-popover">
                      {employees.length === 0 ? (
                        <p className="px-3 py-4 text-center text-sm text-muted-foreground">{tr("لا يوجد موظفون نشطون متاحون لك بعد")}</p>
                      ) : employees.map((employee) => <SelectItem key={employee.id} value={employee.id}>{employee.full_name}</SelectItem>)}
                    </SelectContent>
                  </Select>
                </Field>
                <Field label={tr("نوع الإجازة")}>
                  <Select value={form.leaveType} onValueChange={(leaveType) => setForm((value) => ({ ...value, leaveType }))}>
                    <SelectTrigger className="h-11 border-input bg-background text-foreground focus:ring-ring"><SelectValue /></SelectTrigger>
                    <SelectContent position="popper" className="z-[60]">{Object.entries(LEAVE_TYPES).map(([value, label]) => <SelectItem key={value} value={value}>{label}</SelectItem>)}</SelectContent>
                  </Select>
                  {form.leaveType === "other" ? (
                    <div className="mt-2 animate-in fade-in-0 slide-in-from-top-2 duration-200 space-y-1.5">
                      <label htmlFor="leave-type-other" className="text-xs text-muted-foreground">{tr("اسم نوع الإجازة")}</label>
                      <Input id="leave-type-other" required maxLength={60} value={form.leaveTypeOther} onChange={(event) => setForm((value) => ({ ...value, leaveTypeOther: event.target.value }))} className="h-10 border-input bg-background" />
                    </div>
                  ) : null}
                </Field>
                <div className="space-y-3 rounded-lg border border-primary/10 bg-primary/[0.025] p-3 shadow-sm backdrop-blur-md">
                  <Field label={tr("من تاريخ")}>
                    <GlassDatePicker ariaLabel={tr("تاريخ البداية")} value={form.startDate} onChange={(startDate) => setForm((value) => ({ ...value, startDate, endDate: value.endDate && value.endDate < startDate ? "" : value.endDate }))} />
                  </Field>
                  <div className="h-px bg-border/70" aria-hidden />
                  <Field label={tr("إلى تاريخ")}>
                    <GlassDatePicker ariaLabel={tr("تاريخ النهاية")} value={form.endDate} minDate={form.startDate || undefined} onChange={(endDate) => setForm((value) => ({ ...value, endDate }))} />
                  </Field>
                </div>
                <Button type="submit" disabled={saving || employees.length === 0} className="h-11 w-full bg-primary text-primary-foreground hover:bg-primary/90">
                  {saving ? <LoaderCircle className="animate-spin" aria-hidden /> : null}
                  {tr("إرسال الطلب")}
                </Button>
              </form>
            </DialogContent>
          </Dialog>
        ) : null}
        </div>
      </div>

      <div className="grid grid-cols-4 gap-1 rounded-lg border border-border bg-card p-1.5 shadow-sm" role="tablist" aria-label={tr("تصفية طلبات الإجازة")}>
        {FILTERS.map((item) => (
          <Button key={item.value} type="button" role="tab" aria-selected={filter === item.value} variant="ghost" onClick={() => setFilter(item.value)} className={cn("h-10 min-w-0 gap-1 rounded-md px-1 text-[11px] font-normal text-muted-foreground hover:bg-accent hover:text-foreground", filter === item.value && "bg-primary/10 font-medium text-primary")}> 
            <span className="truncate">{item.label}</span>
            <span className="text-[10px] opacity-70">{counts[item.value]}</span>
          </Button>
        ))}
      </div>

      {feedback ? (
        <div role="status" className={cn("rounded-md border border-border bg-card px-3 py-2 text-xs", feedback.kind === "success" ? "text-leave-approved" : "text-leave-rejected")}> 
          {feedback.message}
        </div>
      ) : null}

      {loading || roleLoading ? (
        <div className="flex min-h-52 items-center justify-center text-muted-foreground"><LoaderCircle className="size-6 animate-spin" aria-label={tr("جارٍ تحميل الطلبات")} /></div>
      ) : error ? (
        <div className="rounded-lg border border-border bg-card p-6 text-center shadow-sm"><p className="text-sm text-muted-foreground">{error}</p><Button variant="ghost" className="mt-3 text-foreground" onClick={() => void loadData()}>{tr("إعادة المحاولة")}</Button></div>
      ) : visibleRequests.length === 0 ? (
        <div className="rounded-lg border border-border bg-card px-5 py-10 text-center shadow-sm"><CalendarDays className="mx-auto size-7 text-muted-foreground" aria-hidden /><p className="mt-3 text-sm font-medium">{tr("لا توجد طلبات هنا")}</p><p className="mt-1 text-xs text-muted-foreground">{tr("ستظهر الطلبات عند إضافتها.")}</p></div>
      ) : (
        <div className="space-y-3">
          {visibleRequests.map((request) => {
            const status = request.status === "approved" ? STATUS.approved : request.status === "rejected" ? STATUS.rejected : STATUS.pending;
            const employee = Array.isArray(request.employees) ? request.employees[0] : request.employees;
            return (
              <div key={request.id} className={cn("relative overflow-hidden rounded-lg border border-border bg-card p-4 shadow-sm", status.border)}>
                <div className="grid grid-cols-[minmax(0,1fr)_auto] items-start gap-3">
                  <div className="min-w-0">
                    {isAdmin ? <p className="flex min-w-0 items-center gap-2 text-sm font-medium"><UserRound className="size-4 shrink-0 text-muted-foreground" aria-hidden /><span className="truncate">{employee?.full_name ?? tr("موظف")}</span></p> : null}
                    <p className={cn("font-medium", isAdmin ? "mt-3 text-[15px]" : "text-[15px]")}>{request.leave_type === "other" && request.leave_type_other ? request.leave_type_other : (LEAVE_TYPES[request.leave_type] ?? request.leave_type)}</p>
                    <p className="mt-2 flex items-center gap-2 text-xs leading-6 text-muted-foreground"><CalendarDays className="size-4 shrink-0" aria-hidden /><span>{formatDate(request.start_date)} — {formatDate(request.end_date)}</span></p>
                  </div>
                   <span className={cn("inline-flex items-center gap-1.5 whitespace-nowrap rounded-full border border-border bg-background px-2.5 py-1 text-[11px]", status.text)}><span className={cn("size-1.5 rounded-full", status.dot)} />{status.label}</span>
                </div>
                {isAdmin && request.status === "pending" ? (
                  <div className="mt-4 grid grid-cols-2 gap-2 border-t border-border pt-3">
                    <Button type="button" variant="ghost" disabled={actingId === request.id} onClick={() => void updateStatus(request.id, "approved")} className="h-10 text-leave-approved hover:bg-accent hover:text-leave-approved"><Check aria-hidden />{tr("اعتماد")}</Button>
                    <Button type="button" variant="ghost" disabled={actingId === request.id} onClick={() => void updateStatus(request.id, "rejected")} className="h-10 text-leave-rejected hover:bg-accent hover:text-leave-rejected"><X aria-hidden />{tr("رفض")}</Button>
                  </div>
                ) : null}
              </div>
            );
          })}
        </div>
      )}
    </section>
  );
}

type Filter = "all" | "pending" | "approved" | "rejected";
type Employee = { id: string; full_name: string };
type LeaveRequest = {
  leave_type_other?: string | null;
  id: string;
  employee_id: string;
  leave_type: string;
  start_date: string;
  end_date: string;
  status: string;
  created_at: string;
  employees: { full_name: string } | { full_name: string }[] | null;
};

const FILTERS: { value: Filter; label: string }[] = [
  { value: "all", label: tr("الكل") },
  { value: "pending", label: tr("معلّق") },
  { value: "approved", label: tr("معتمد") },
  { value: "rejected", label: tr("مرفوض") },
];
const LEAVE_TYPES: Record<string, string> = { annual: tr("إجازة سنوية"), sick: tr("إجازة مرضية"), emergency: tr("إجازة طارئة"), unpaid: tr("إجازة بدون راتب"), other: tr("أخرى") };
const STATUS = {
  pending: { label: tr("معلّق"), dot: "bg-leave-pending", text: "text-leave-pending", border: "border-s-2 border-s-leave-pending" },
  approved: { label: tr("معتمد"), dot: "bg-leave-approved", text: "text-leave-approved", border: "border-s-2 border-s-leave-approved" },
  rejected: { label: tr("مرفوض"), dot: "bg-leave-rejected", text: "text-leave-rejected", border: "border-s-2 border-s-leave-rejected" },
} as const;

function formatDate(value: string) {
  return new Intl.DateTimeFormat(getLocale(), { day: "numeric", month: "short", year: "numeric", timeZone: "UTC" }).format(new Date(`${value}T00:00:00Z`));
}

function Field({ label, children }: { label: string; children: ReactNode }) {
  return <label className="block space-y-1.5"><span className="text-xs font-normal text-muted-foreground">{label}</span>{children}</label>;
}
