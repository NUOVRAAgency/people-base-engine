import { createFileRoute } from "@tanstack/react-router";
import { CalendarDays, Check, LoaderCircle, Plus, UserRound, X } from "lucide-react";
import { useCallback, useEffect, useMemo, useState, type FormEvent, type ReactNode } from "react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import { GlassSurface } from "@/components/ui/glass-surface";
import { Input } from "@/components/ui/input";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { useCurrentUser } from "@/hooks/use-current-user";
import { supabase } from "@/integrations/supabase/client";
import { cn } from "@/lib/utils";

export const Route = createFileRoute("/_authenticated/leaves")({
  head: () => ({
    meta: [
      { title: "الإجازات | نظام الموارد البشرية" },
      { name: "description", content: "طلبات الإجازات والموافقات" },
      { property: "og:title", content: "الإجازات | نظام الموارد البشرية" },
      { property: "og:description", content: "طلبات الإجازات والموافقات" },
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
  const [form, setForm] = useState({ employeeId: "", leaveType: "annual", startDate: "", endDate: "" });

  const canCreate = role === "admin" || role === "operator";

  const loadData = useCallback(async () => {
    setLoading(true);
    setError("");
    const [requestsResult, employeesResult] = await Promise.all([
      supabase
        .from("leave_requests")
        .select("id,employee_id,leave_type,start_date,end_date,status,created_at,employees(full_name)")
        .order("created_at", { ascending: false }),
      supabase.from("employees").select("id,full_name").eq("status", "active").order("full_name"),
    ]);
    if (requestsResult.error || employeesResult.error) {
      setError("تعذّر تحميل طلبات الإجازة. حاول مرة أخرى.");
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
    if (!form.employeeId || !form.startDate || !form.endDate) {
      toast.error("أكمل جميع الحقول المطلوبة");
      return;
    }
    if (form.endDate < form.startDate) {
      toast.error("تاريخ النهاية يجب أن يكون بعد تاريخ البداية");
      return;
    }
    setSaving(true);
    const { error: insertError } = await supabase.from("leave_requests").insert({
      employee_id: form.employeeId,
      leave_type: form.leaveType,
      start_date: form.startDate,
      end_date: form.endDate,
      status: "pending",
    });
    setSaving(false);
    if (insertError) {
      toast.error("لم يتم حفظ الطلب", { description: "تحقق من صلاحيات الموظف المختار ثم حاول مجدداً." });
      return;
    }
    setDialogOpen(false);
    setForm({ employeeId: "", leaveType: "annual", startDate: "", endDate: "" });
    toast.success("تم إرسال طلب الإجازة");
    window.dispatchEvent(new Event("hr-header-refresh"));
    await loadData();
  }

  async function updateStatus(id: string, status: "approved" | "rejected") {
    setActingId(id);
    const { error: updateError } = await supabase.from("leave_requests").update({ status }).eq("id", id);
    setActingId("");
    if (updateError) {
      toast.error("تعذّر تحديث حالة الطلب");
      return;
    }
    toast.success(status === "approved" ? "تم اعتماد الطلب" : "تم رفض الطلب");
    window.dispatchEvent(new Event("hr-header-refresh"));
    await loadData();
  }

  return (
    <section className="mx-auto w-full max-w-xl space-y-4 text-glass-foreground" aria-labelledby="leaves-heading">
      <div className="grid grid-cols-[minmax(0,1fr)_auto] items-center gap-3">
        <div className="min-w-0">
          <p className="text-xs text-glass-muted">إدارة الطلبات</p>
          <h2 id="leaves-heading" className="truncate text-xl font-bold leading-relaxed">إجازات الفريق</h2>
        </div>
        {canCreate ? (
          <Dialog open={dialogOpen} onOpenChange={setDialogOpen}>
            <DialogTrigger asChild>
              <Button aria-label="إضافة طلب إجازة" size="icon" className="app-glass min-h-11 min-w-11 rounded-full text-glass-foreground shadow-none hover:bg-glass-surface">
                <Plus className="size-5" aria-hidden />
              </Button>
            </DialogTrigger>
            <DialogContent dir="rtl" className="app-night app-glass left-3 right-3 top-auto bottom-3 w-auto max-w-none translate-x-0 translate-y-0 rounded-lg border-glass-line p-5 text-glass-foreground sm:left-1/2 sm:right-auto sm:top-1/2 sm:bottom-auto sm:w-[min(430px,calc(100vw-32px))] sm:-translate-x-1/2 sm:-translate-y-1/2">
              <DialogHeader className="text-right sm:text-right">
                <DialogTitle className="text-lg leading-relaxed">طلب إجازة جديد</DialogTitle>
                <DialogDescription className="text-glass-muted">يُرسل الطلب بحالة معلّق للمراجعة.</DialogDescription>
              </DialogHeader>
              <form className="space-y-4" onSubmit={submitRequest}>
                <Field label="الموظف">
                  <Select value={form.employeeId} onValueChange={(employeeId) => setForm((value) => ({ ...value, employeeId }))}>
                    <SelectTrigger className="h-11 border-glass-line bg-glass-surface text-glass-foreground focus:ring-glass-line">
                      <SelectValue placeholder="اختر الموظف" />
                    </SelectTrigger>
                    <SelectContent className="border-glass-line bg-popover">
                      {employees.map((employee) => <SelectItem key={employee.id} value={employee.id}>{employee.full_name}</SelectItem>)}
                    </SelectContent>
                  </Select>
                </Field>
                <Field label="نوع الإجازة">
                  <Select value={form.leaveType} onValueChange={(leaveType) => setForm((value) => ({ ...value, leaveType }))}>
                    <SelectTrigger className="h-11 border-glass-line bg-glass-surface text-glass-foreground focus:ring-glass-line"><SelectValue /></SelectTrigger>
                    <SelectContent>{Object.entries(LEAVE_TYPES).map(([value, label]) => <SelectItem key={value} value={value}>{label}</SelectItem>)}</SelectContent>
                  </Select>
                </Field>
                <div className="grid grid-cols-2 gap-3">
                  <Field label="من">
                    <Input required type="date" value={form.startDate} onChange={(event) => setForm((value) => ({ ...value, startDate: event.target.value }))} className="h-11 border-glass-line bg-glass-surface text-glass-foreground scheme-dark focus-visible:ring-glass-line" />
                  </Field>
                  <Field label="إلى">
                    <Input required type="date" min={form.startDate} value={form.endDate} onChange={(event) => setForm((value) => ({ ...value, endDate: event.target.value }))} className="h-11 border-glass-line bg-glass-surface text-glass-foreground scheme-dark focus-visible:ring-glass-line" />
                  </Field>
                </div>
                <Button type="submit" disabled={saving || employees.length === 0} className="h-11 w-full bg-glass-foreground text-background hover:bg-glass-foreground/90">
                  {saving ? <LoaderCircle className="animate-spin" aria-hidden /> : null}
                  إرسال الطلب
                </Button>
              </form>
            </DialogContent>
          </Dialog>
        ) : null}
      </div>

      <GlassSurface className="grid grid-cols-4 gap-1 rounded-lg p-1.5 shadow-none" role="tablist" aria-label="تصفية طلبات الإجازة">
        {FILTERS.map((item) => (
          <Button key={item.value} type="button" role="tab" aria-selected={filter === item.value} variant="ghost" onClick={() => setFilter(item.value)} className={cn("h-10 min-w-0 gap-1 rounded-md px-1 text-[11px] text-glass-muted hover:bg-glass-surface hover:text-glass-foreground", filter === item.value && "bg-glass-surface text-glass-foreground ring-1 ring-glass-line")}>
            <span className="truncate">{item.label}</span>
            <span className="text-[10px] opacity-70">{counts[item.value]}</span>
          </Button>
        ))}
      </GlassSurface>

      {loading || roleLoading ? (
        <div className="flex min-h-52 items-center justify-center text-glass-muted"><LoaderCircle className="size-6 animate-spin" aria-label="جارٍ تحميل الطلبات" /></div>
      ) : error ? (
        <GlassSurface className="rounded-lg p-6 text-center"><p className="text-sm text-glass-muted">{error}</p><Button variant="ghost" className="mt-3 text-glass-foreground" onClick={() => void loadData()}>إعادة المحاولة</Button></GlassSurface>
      ) : visibleRequests.length === 0 ? (
        <GlassSurface className="rounded-lg px-5 py-10 text-center"><CalendarDays className="mx-auto size-7 text-glass-muted" aria-hidden /><p className="mt-3 text-sm font-medium">لا توجد طلبات هنا</p><p className="mt-1 text-xs text-glass-muted">ستظهر الطلبات عند إضافتها.</p></GlassSurface>
      ) : (
        <div className="space-y-3">
          {visibleRequests.map((request) => {
            const status = request.status === "approved" ? STATUS.approved : request.status === "rejected" ? STATUS.rejected : STATUS.pending;
            const employee = Array.isArray(request.employees) ? request.employees[0] : request.employees;
            return (
              <GlassSurface key={request.id} className={cn("relative overflow-hidden rounded-lg border-s-0 p-4", status.border)}>
                <div className="grid grid-cols-[minmax(0,1fr)_auto] items-start gap-3">
                  <div className="min-w-0">
                    {isAdmin ? <p className="flex min-w-0 items-center gap-2 text-sm font-bold"><UserRound className="size-4 shrink-0 text-glass-muted" aria-hidden /><span className="truncate">{employee?.full_name ?? "موظف"}</span></p> : null}
                    <p className={cn("font-semibold", isAdmin ? "mt-3 text-[15px]" : "text-[15px]")}>{LEAVE_TYPES[request.leave_type] ?? request.leave_type}</p>
                    <p className="mt-2 flex items-center gap-2 text-xs leading-6 text-glass-muted"><CalendarDays className="size-4 shrink-0" aria-hidden /><span>{formatDate(request.start_date)} — {formatDate(request.end_date)}</span></p>
                  </div>
                  <span className={cn("inline-flex items-center gap-1.5 whitespace-nowrap rounded-full border border-glass-line bg-glass-surface px-2.5 py-1 text-[11px]", status.text)}><span className={cn("size-1.5 rounded-full", status.dot)} />{status.label}</span>
                </div>
                {isAdmin && request.status === "pending" ? (
                  <div className="mt-4 grid grid-cols-2 gap-2 border-t border-glass-line pt-3">
                    <Button type="button" variant="ghost" disabled={actingId === request.id} onClick={() => void updateStatus(request.id, "approved")} className="h-10 text-leave-approved hover:bg-glass-surface hover:text-leave-approved"><Check aria-hidden />اعتماد</Button>
                    <Button type="button" variant="ghost" disabled={actingId === request.id} onClick={() => void updateStatus(request.id, "rejected")} className="h-10 text-leave-rejected hover:bg-glass-surface hover:text-leave-rejected"><X aria-hidden />رفض</Button>
                  </div>
                ) : null}
              </GlassSurface>
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
  { value: "all", label: "الكل" },
  { value: "pending", label: "معلّق" },
  { value: "approved", label: "معتمد" },
  { value: "rejected", label: "مرفوض" },
];
const LEAVE_TYPES: Record<string, string> = { annual: "إجازة سنوية", sick: "إجازة مرضية", emergency: "إجازة طارئة", unpaid: "إجازة بدون راتب" };
const STATUS = {
  pending: { label: "معلّق", dot: "bg-leave-pending", text: "text-leave-pending", border: "border-s-2 border-s-leave-pending" },
  approved: { label: "معتمد", dot: "bg-leave-approved", text: "text-leave-approved", border: "border-s-2 border-s-leave-approved" },
  rejected: { label: "مرفوض", dot: "bg-leave-rejected", text: "text-leave-rejected", border: "border-s-2 border-s-leave-rejected" },
} as const;

function formatDate(value: string) {
  return new Intl.DateTimeFormat("ar", { day: "numeric", month: "short", year: "numeric", timeZone: "UTC" }).format(new Date(`${value}T00:00:00Z`));
}

function Field({ label, children }: { label: string; children: ReactNode }) {
  return <label className="block space-y-1.5"><span className="text-xs font-medium text-glass-muted">{label}</span>{children}</label>;
}
