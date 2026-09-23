import { createFileRoute } from "@tanstack/react-router";
import {
  BriefcaseBusiness,
  Check,
  ChevronLeft,
  ChevronRight,
  CircleAlert,
  Eye,
  LoaderCircle,
  Mail,
  MoreHorizontal,
  Pencil,
  Plus,
  Search,
  Trash2,
  UserRound,
  WalletCards,
  X,
} from "lucide-react";
import { useCallback, useEffect, useMemo, useState, type FormEvent, type ReactNode } from "react";
import { z } from "zod";
import { GlassDatePicker } from "@/components/glass-date-picker";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { useCurrentUser } from "@/hooks/use-current-user";
import { supabase } from "@/integrations/supabase/client";
import { cn } from "@/lib/utils";

export const Route = createFileRoute("/_authenticated/employees")({
  head: () => ({
    meta: [
      { title: "إدارة الموظفين | نظام الموارد البشرية" },
      { name: "description", content: "البحث وإدارة أعضاء الفريق وبياناتهم الوظيفية" },
      { property: "og:title", content: "إدارة الموظفين | نظام الموارد البشرية" },
      { property: "og:description", content: "البحث وإدارة أعضاء الفريق وبياناتهم الوظيفية" },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary_large_image" },
    ],
  }),
  component: EmployeesPage,
});

type Employee = {
  id: string;
  employee_number: string;
  full_name: string;
  full_name_en: string | null;
  work_email: string | null;
  department: string | null;
  position: string | null;
  manager_id: string | null;
  hire_date: string | null;
  employment_type: string;
  national_id: string | null;
  birth_date: string | null;
  nationality: string | null;
  gender: string | null;
  phone: string | null;
  status: string;
  branch_id: string | null;
};

type Branch = { id: string; name: string };
type Feedback = { kind: "success" | "error"; message: string } | null;
type FieldErrors = Partial<Record<keyof EmployeeForm, string>>;

type EmployeeForm = {
  employeeNumber: string;
  workEmail: string;
  department: string;
  position: string;
  managerId: string;
  branchId: string;
  hireDate: string;
  employmentType: string;
  fullName: string;
  fullNameEn: string;
  nationalId: string;
  birthDate: string;
  nationality: string;
  gender: string;
  phone: string;
  baseSalary: string;
  housingAllowance: string;
  transportAllowance: string;
  bankName: string;
};

const EMPTY_FORM: EmployeeForm = {
  employeeNumber: "",
  workEmail: "",
  department: "",
  position: "",
  managerId: "none",
  branchId: "",
  hireDate: "",
  employmentType: "full_time",
  fullName: "",
  fullNameEn: "",
  nationalId: "",
  birthDate: "",
  nationality: "",
  gender: "male",
  phone: "",
  baseSalary: "",
  housingAllowance: "",
  transportAllowance: "",
  bankName: "",
};

const employmentSchema = z.object({
  workEmail: z.string().trim().email("أدخل بريداً عملياً صحيحاً").max(255),
  department: z.string().trim().min(1, "القسم مطلوب").max(100),
  position: z.string().trim().min(1, "المسمى الوظيفي مطلوب").max(100),
  branchId: z.string().uuid("اختر الفرع"),
  hireDate: z.string().date("اختر تاريخ التعيين"),
});

const personalSchema = z.object({
  fullName: z.string().trim().min(3, "أدخل الاسم الكامل").max(150),
  nationalId: z.string().trim().min(5, "أدخل رقم هوية أو جواز صحيحاً").max(30).regex(/^[\p{L}\p{N}-]+$/u, "استخدم الحروف والأرقام والشرطة فقط"),
  phone: z.string().trim().regex(/^\+?[0-9\s-]{7,18}$/, "أدخل رقم جوال صحيحاً"),
  birthDate: z.string().date("اختر تاريخ الميلاد").refine((value) => new Date(`${value}T12:00:00`) < new Date(), "تاريخ الميلاد يجب أن يكون في الماضي"),
  gender: z.enum(["male", "female"], { message: "اختر الجنس" }),
  nationality: z.string().trim().min(2, "الجنسية مطلوبة").max(80),
});

const financialSchema = z.object({
  baseSalary: z.string().trim().min(1, "أدخل الراتب الأساسي").transform(Number).refine((value) => Number.isFinite(value) && value >= 0, "لا يمكن أن يكون الراتب سالباً"),
  housingAllowance: z.string().trim().min(1, "أدخل بدل السكن أو صفراً").transform(Number).refine((value) => Number.isFinite(value) && value >= 0, "لا يمكن أن يكون بدل السكن سالباً"),
  transportAllowance: z.string().trim().min(1, "أدخل بدل النقل أو صفراً").transform(Number).refine((value) => Number.isFinite(value) && value >= 0, "لا يمكن أن يكون بدل النقل سالباً"),
  bankName: z.string().trim().min(2, "اسم البنك مطلوب").max(100),
});

const EMPLOYMENT_LABELS: Record<string, string> = {
  full_time: "دوام كامل",
  part_time: "دوام جزئي",
  remote: "عن بُعد",
};

const STEPS = [
  { label: "البيانات الوظيفية", icon: BriefcaseBusiness },
  { label: "البيانات الشخصية", icon: UserRound },
  { label: "البيانات المالية", icon: WalletCards },
];

function EmployeesPage() {
  const { role, isAdmin, loading: roleLoading } = useCurrentUser();
  const [employees, setEmployees] = useState<Employee[]>([]);
  const [branches, setBranches] = useState<Branch[]>([]);
  const [myBranchId, setMyBranchId] = useState("");
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState("");
  const [department, setDepartment] = useState("all");
  const [status, setStatus] = useState("all");
  const [employmentType, setEmploymentType] = useState("all");
  const [wizardOpen, setWizardOpen] = useState(false);
  const [detailsOpen, setDetailsOpen] = useState(false);
  const [deleteOpen, setDeleteOpen] = useState(false);
  const [selected, setSelected] = useState<Employee | null>(null);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [step, setStep] = useState(1);
  const [form, setForm] = useState<EmployeeForm>(EMPTY_FORM);
  const [saving, setSaving] = useState(false);
  const [feedback, setFeedback] = useState<Feedback>(null);
  const [fieldErrors, setFieldErrors] = useState<FieldErrors>({});

  const canWrite = role === "admin" || role === "operator";

  const loadData = useCallback(async () => {
    setLoading(true);
    const userResult = await supabase.auth.getUser();
    const userId = userResult.data.user?.id;
    const [employeeResult, branchResult, profileResult] = await Promise.all([
      supabase
        .from("employees")
        .select("id,employee_number,full_name,full_name_en,work_email,department,position,manager_id,hire_date,employment_type,national_id,birth_date,nationality,gender,phone,status,branch_id")
        .order("created_at", { ascending: false }),
      supabase.from("branches").select("id,name").eq("status", "active").order("name"),
      userId ? supabase.from("users").select("branch_id").eq("id", userId).maybeSingle() : Promise.resolve({ data: null }),
    ]);

    if (employeeResult.error || branchResult.error) {
      setFeedback({ kind: "error", message: "تعذّر تحميل بيانات الموظفين. حاول مرة أخرى." });
    } else {
      setEmployees((employeeResult.data ?? []) as Employee[]);
      setBranches(branchResult.data ?? []);
      setMyBranchId(profileResult.data?.branch_id ?? "");
    }
    setLoading(false);
  }, []);

  useEffect(() => {
    void loadData();
  }, [loadData]);

  const departments = useMemo(
    () => Array.from(new Set(employees.map((employee) => employee.department).filter((value): value is string => Boolean(value)))).sort(),
    [employees],
  );

  const filteredEmployees = useMemo(() => {
    const term = search.trim().toLocaleLowerCase("ar");
    return employees.filter((employee) => {
      const matchesSearch = !term
        || employee.full_name.toLocaleLowerCase("ar").includes(term)
        || employee.employee_number.toLocaleLowerCase("ar").includes(term);
      return matchesSearch
        && (department === "all" || employee.department === department)
        && (status === "all" || employee.status === status)
        && (employmentType === "all" || employee.employment_type === employmentType);
    });
  }, [department, employees, employmentType, search, status]);

  useEffect(() => {
    if (department !== "all" && !departments.includes(department)) setDepartment("all");
  }, [department, departments]);

  function openCreate() {
    setEditingId(null);
    setStep(1);
    setForm({ ...EMPTY_FORM, branchId: isAdmin ? (branches[0]?.id ?? "") : myBranchId });
    setFeedback(null);
    setFieldErrors({});
    setWizardOpen(true);
  }

  async function openEdit(employee: Employee) {
    setEditingId(employee.id);
    setStep(1);
    setFeedback(null);
    let payroll = { base_salary: 0, housing_allowance: 0, transport_allowance: 0, bank_name: null as string | null };
    if (isAdmin) {
      const result = await supabase
        .from("payroll")
        .select("base_salary,housing_allowance,transport_allowance,bank_name")
        .eq("employee_id", employee.id)
        .order("month", { ascending: false })
        .limit(1)
        .maybeSingle();
      if (result.data) payroll = result.data;
    }
    setForm({
      employeeNumber: employee.employee_number,
      workEmail: employee.work_email ?? "",
      department: employee.department ?? "",
      position: employee.position ?? "",
      managerId: employee.manager_id ?? "none",
      branchId: employee.branch_id ?? "",
      hireDate: employee.hire_date ?? "",
      employmentType: employee.employment_type,
      fullName: employee.full_name,
      fullNameEn: employee.full_name_en ?? "",
      nationalId: employee.national_id ?? "",
      birthDate: employee.birth_date ?? "",
      nationality: employee.nationality ?? "",
      gender: employee.gender ?? "male",
      phone: employee.phone ?? "",
      baseSalary: String(payroll.base_salary || ""),
      housingAllowance: String(payroll.housing_allowance || ""),
      transportAllowance: String(payroll.transport_allowance || ""),
      bankName: payroll.bank_name ?? "",
    });
    setWizardOpen(true);
  }

  function setField<K extends keyof EmployeeForm>(field: K, value: EmployeeForm[K]) {
    setForm((current) => ({ ...current, [field]: value }));
    setFieldErrors((current) => ({ ...current, [field]: undefined }));
  }

  function validateStep(currentStep: number) {
    const schema = currentStep === 1 ? employmentSchema : currentStep === 2 ? personalSchema : isAdmin ? financialSchema : null;
    if (!schema) return true;
    const result = schema.safeParse(form);
    if (!result.success) {
      const errors: FieldErrors = {};
      result.error.issues.forEach((issue) => {
        const field = issue.path[0] as keyof EmployeeForm | undefined;
        if (field && !errors[field]) errors[field] = issue.message;
      });
      setFieldErrors(errors);
      setFeedback({ kind: "error", message: "راجع الحقول الموضحة قبل المتابعة" });
      return false;
    }
    setFieldErrors({});
    setFeedback(null);
    return true;
  }

  function nextStep() {
    if (validateStep(step)) setStep((current) => Math.min(3, current + 1));
  }

  function selectStep(target: number) {
    setFieldErrors({});
    setFeedback(null);
    setStep(target);
  }

  function validateAllSteps() {
    const schemas = [employmentSchema, personalSchema, ...(isAdmin ? [financialSchema] : [])];
    const errors: FieldErrors = {};
    let firstInvalidStep: number | null = null;

    schemas.forEach((schema, index) => {
      const result = schema.safeParse(form);
      if (result.success) return;
      if (firstInvalidStep === null) firstInvalidStep = index + 1;
      result.error.issues.forEach((issue) => {
        const field = issue.path[0] as keyof EmployeeForm | undefined;
        if (field && !errors[field]) errors[field] = issue.message;
      });
    });

    if (firstInvalidStep !== null) {
      setFieldErrors(errors);
      setFeedback({ kind: "error", message: "راجع الحقول الموضحة قبل حفظ الموظف" });
      setStep(firstInvalidStep);
      return false;
    }
    setFieldErrors({});
    return true;
  }

  async function saveEmployee(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!validateAllSteps()) return;
    setSaving(true);
    setFeedback(null);

    const employeePayload = {
      ...(form.employeeNumber.trim() ? { employee_number: form.employeeNumber.trim() } : {}),
      full_name: form.fullName.trim(),
      full_name_en: form.fullNameEn.trim(),
      work_email: form.workEmail.trim(),
      department: form.department.trim(),
      position: form.position.trim(),
      manager_id: form.managerId === "none" ? null : form.managerId,
      branch_id: form.branchId,
      hire_date: form.hireDate,
      employment_type: form.employmentType,
      national_id: form.nationalId.trim(),
      birth_date: form.birthDate,
      nationality: form.nationality.trim(),
      gender: form.gender,
      phone: form.phone.trim(),
    };

    let employeeId = editingId;
    if (editingId) {
      const result = await supabase.from("employees").update(employeePayload).eq("id", editingId).select("id").single();
      if (result.error) {
        setSaving(false);
        setFeedback({ kind: "error", message: result.error.code === "23505" ? "الرقم الوظيفي أو البريد أو الهوية مستخدم مسبقاً" : "تعذّر تحديث بيانات الموظف" });
        return;
      }
    } else {
      const result = await supabase.from("employees").insert(employeePayload).select("id").single();
      if (result.error) {
        setSaving(false);
        setFeedback({ kind: "error", message: result.error.code === "23505" ? "الرقم الوظيفي أو البريد أو الهوية مستخدم مسبقاً" : "تعذّر إضافة الموظف. تحقق من الفرع والصلاحيات." });
        return;
      }
      employeeId = result.data.id;
    }

    if (isAdmin && employeeId && form.baseSalary) {
      const month = `${form.hireDate.slice(0, 7)}-01`;
      const financialResult = await supabase.from("payroll").upsert({
        employee_id: employeeId,
        month,
        base_salary: Number(form.baseSalary),
        housing_allowance: Number(form.housingAllowance || 0),
        transport_allowance: Number(form.transportAllowance || 0),
        bank_name: form.bankName.trim() || null,
      }, { onConflict: "employee_id,month" });
      if (financialResult.error) {
        setSaving(false);
        setFeedback({ kind: "error", message: "حُفظ الموظف، لكن تعذّر حفظ بياناته المالية" });
        await loadData();
        return;
      }
    }

    setSaving(false);
    setWizardOpen(false);
    setFeedback({ kind: "success", message: editingId ? "تم تحديث بيانات الموظف بنجاح" : "تمت إضافة الموظف بنجاح" });
    await loadData();
  }

  async function deleteEmployee() {
    if (!selected || !isAdmin) return;
    const result = await supabase.from("employees").delete().eq("id", selected.id);
    setDeleteOpen(false);
    if (result.error) {
      setFeedback({ kind: "error", message: "تعذّر حذف الموظف لوجود سجلات مرتبطة به" });
      return;
    }
    setFeedback({ kind: "success", message: "تم حذف الموظف" });
    setSelected(null);
    await loadData();
  }

  return (
    <section className="mx-auto w-full max-w-6xl space-y-4 font-sans text-foreground" aria-labelledby="employees-heading">
      <div className="flex items-center justify-between gap-3">
        <div className="min-w-0">
          <p className="text-xs text-muted-foreground">دليل الفريق</p>
          <h2 id="employees-heading" className="truncate text-xl font-semibold leading-relaxed">إدارة الموظفين</h2>
        </div>
        {!roleLoading && canWrite ? (
          <Button type="button" onClick={openCreate} className="h-11 shrink-0 rounded-lg bg-primary px-3 text-primary-foreground shadow-nav hover:bg-primary/90 sm:px-4">
            <Plus aria-hidden />
            <span className="hidden sm:inline">إضافة موظف جديد</span>
            <span className="sm:hidden">إضافة موظف</span>
          </Button>
        ) : null}
      </div>

      {feedback ? (
        <div className={cn("flex items-center gap-2 rounded-lg border px-3 py-2.5 text-sm", feedback.kind === "success" ? "border-success/25 bg-success/10 text-success" : "border-destructive/25 bg-destructive/10 text-destructive")}>
          {feedback.kind === "success" ? <Check className="size-4" /> : <CircleAlert className="size-4" />}
          <span className="flex-1">{feedback.message}</span>
          <Button type="button" size="icon-sm" variant="ghost" aria-label="إخفاء الرسالة" onClick={() => setFeedback(null)}><X /></Button>
        </div>
      ) : null}

      <div className="rounded-lg border border-primary/10 bg-card/90 p-3 shadow-card backdrop-blur-xl">
        <div className="relative">
          <Search className="pointer-events-none absolute end-3 top-1/2 size-4 -translate-y-1/2 text-muted-foreground" aria-hidden />
          <Input
            value={search}
            onChange={(event) => setSearch(event.target.value)}
            placeholder="البحث بالاسم أو الرقم الوظيفي"
            aria-label="البحث بالاسم أو الرقم الوظيفي"
            className="h-11 rounded-lg border-primary/10 bg-background pe-10 shadow-none"
          />
        </div>
        <div className="mt-3 grid grid-cols-1 gap-2 min-[420px]:grid-cols-3">
          <FilterSelect label="القسم" value={department} onChange={setDepartment} options={departments.map((item) => ({ value: item, label: item }))} />
          <FilterSelect label="الحالة" value={status} onChange={setStatus} options={[{ value: "active", label: "نشط" }, { value: "inactive", label: "مستقيل" }]} />
          <FilterSelect label="نوع الدوام" value={employmentType} onChange={setEmploymentType} options={Object.entries(EMPLOYMENT_LABELS).map(([value, label]) => ({ value, label }))} />
        </div>
      </div>

      <div className="overflow-hidden rounded-lg border border-border bg-card shadow-card">
        <div className="flex items-center justify-between border-b border-border px-4 py-3">
          <p className="text-sm font-medium">الموظفون</p>
          <span className="rounded-full bg-primary/8 px-2.5 py-1 text-xs font-medium text-primary">{filteredEmployees.length} موظف</span>
        </div>
        {loading ? (
          <div className="grid min-h-56 place-items-center"><LoaderCircle className="size-6 animate-spin text-primary" aria-label="جارٍ تحميل الموظفين" /></div>
        ) : filteredEmployees.length === 0 ? (
          <div className="grid min-h-56 place-items-center px-6 text-center">
            <div><UserRound className="mx-auto mb-3 size-9 text-muted-foreground/60" /><p className="text-sm font-medium">{employees.length ? "لا توجد نتائج مطابقة" : "لا يوجد موظفون بعد"}</p><p className="mt-1 text-xs text-muted-foreground">{employees.length ? "جرّب تغيير البحث أو الفلاتر" : "أضف أول موظف لبدء بناء دليل الفريق"}</p>{employees.length ? <Button type="button" variant="outline" size="sm" className="mt-3" onClick={() => { setSearch(""); setDepartment("all"); setStatus("all"); setEmploymentType("all"); }}>مسح البحث والفلاتر</Button> : null}</div>
          </div>
        ) : (
          <Table>
            <TableHeader className="bg-muted/45">
              <TableRow className="hover:bg-transparent">
                <TableHead className="min-w-52 text-right">الصورة والاسم الكامل</TableHead>
                <TableHead className="min-w-28 text-right">الرقم الوظيفي</TableHead>
                <TableHead className="min-w-32 text-right">القسم</TableHead>
                <TableHead className="min-w-40 text-right">المسمى الوظيفي</TableHead>
                <TableHead className="min-w-32 text-right">تاريخ التعيين</TableHead>
                <TableHead className="min-w-24 text-right">الحالة</TableHead>
                <TableHead className="w-20 text-center">إجراءات</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {filteredEmployees.map((employee) => (
                <TableRow key={employee.id} className="group">
                  <TableCell className="py-3">
                    <div className="flex items-center gap-3">
                      <EmployeeAvatar name={employee.full_name} />
                      <div className="min-w-0"><p className="font-medium leading-6">{employee.full_name}</p><p dir="ltr" className="truncate text-left text-xs text-muted-foreground">{employee.work_email ?? "—"}</p></div>
                    </div>
                  </TableCell>
                  <TableCell dir="ltr" className="text-right font-medium text-primary">{employee.employee_number}</TableCell>
                  <TableCell>{employee.department ?? "—"}</TableCell>
                  <TableCell>{employee.position ?? "—"}</TableCell>
                  <TableCell>{formatArabicDate(employee.hire_date)}</TableCell>
                  <TableCell><StatusBadge status={employee.status} /></TableCell>
                  <TableCell className="text-center">
                    <EmployeeActions
                      employee={employee}
                      canEdit={canWrite}
                      canDelete={isAdmin}
                      onView={() => { setSelected(employee); setDetailsOpen(true); }}
                      onEdit={() => void openEdit(employee)}
                      onDelete={() => { setSelected(employee); setDeleteOpen(true); }}
                    />
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        )}
      </div>

      <EmployeeWizard
        open={wizardOpen}
        onOpenChange={setWizardOpen}
        step={step}
        setStep={setStep}
        form={form}
        setField={setField}
        branches={branches}
        managers={employees.filter((employee) => employee.id !== editingId && employee.status === "active")}
        isAdmin={isAdmin}
        saving={saving}
        editing={Boolean(editingId)}
        feedback={feedback}
        fieldErrors={fieldErrors}
        onNext={nextStep}
        onSelectStep={selectStep}
        onSubmit={saveEmployee}
      />

      <EmployeeDetails employee={selected} open={detailsOpen} onOpenChange={setDetailsOpen} />

      <AlertDialog open={deleteOpen} onOpenChange={setDeleteOpen}>
        <AlertDialogContent dir="rtl" className="w-[calc(100vw-2rem)] max-w-sm rounded-xl font-sans">
          <AlertDialogHeader className="text-right sm:text-right">
            <AlertDialogTitle>حذف الموظف</AlertDialogTitle>
            <AlertDialogDescription>سيُحذف سجل {selected?.full_name} نهائياً. لا يمكن التراجع عن هذه الخطوة.</AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter className="gap-2 sm:space-x-0">
            <AlertDialogCancel>إلغاء</AlertDialogCancel>
            <AlertDialogAction onClick={() => void deleteEmployee()} className="bg-destructive text-destructive-foreground hover:bg-destructive/90">حذف</AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </section>
  );
}

function FilterSelect({ label, value, onChange, options }: { label: string; value: string; onChange: (value: string) => void; options: { value: string; label: string }[] }) {
  return (
    <Select dir="rtl" value={value} onValueChange={onChange}>
      <SelectTrigger className="h-10 rounded-lg border-primary/10 bg-background"><SelectValue placeholder={label} /></SelectTrigger>
      <SelectContent dir="rtl" position="popper" className="z-[120] max-h-64"><SelectItem value="all">كل {label === "القسم" ? "الأقسام" : label === "الحالة" ? "الحالات" : "أنواع الدوام"}</SelectItem>{options.map((option) => <SelectItem key={option.value} value={option.value}>{option.label}</SelectItem>)}</SelectContent>
    </Select>
  );
}

function EmployeeAvatar({ name }: { name: string }) {
  const initials = name.split(" ").filter(Boolean).slice(0, 2).map((part) => part[0]).join("");
  return <span className="grid size-10 shrink-0 place-items-center rounded-full border border-primary/15 bg-primary/8 text-sm font-semibold text-primary shadow-sm">{initials}</span>;
}

function StatusBadge({ status }: { status: string }) {
  const active = status === "active";
  return <span className={cn("inline-flex items-center gap-1.5 rounded-full border px-2.5 py-1 text-xs font-medium", active ? "border-success/20 bg-success/10 text-success" : "border-destructive/15 bg-muted text-muted-foreground")}><span className={cn("size-1.5 rounded-full", active ? "bg-success" : "bg-muted-foreground")} />{active ? "نشط" : "مستقيل"}</span>;
}

function EmployeeActions({ employee, canEdit, canDelete, onView, onEdit, onDelete }: { employee: Employee; canEdit: boolean; canDelete: boolean; onView: () => void; onEdit: () => void; onDelete: () => void }) {
  return (
    <DropdownMenu dir="rtl">
      <DropdownMenuTrigger asChild><Button type="button" variant="ghost" size="icon" aria-label={`إجراءات ${employee.full_name}`}><MoreHorizontal /></Button></DropdownMenuTrigger>
      <DropdownMenuContent align="end" className="w-40">
        <DropdownMenuItem onSelect={onView}><Eye />عرض الملف</DropdownMenuItem>
        {canEdit ? <DropdownMenuItem onSelect={onEdit}><Pencil />تعديل</DropdownMenuItem> : null}
        {canDelete ? <DropdownMenuItem onSelect={onDelete} className="text-destructive focus:text-destructive"><Trash2 />حذف</DropdownMenuItem> : null}
      </DropdownMenuContent>
    </DropdownMenu>
  );
}

function EmployeeWizard({ open, onOpenChange, step, setStep, form, setField, branches, managers, isAdmin, saving, editing, feedback, fieldErrors, onNext, onSelectStep, onSubmit }: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  step: number;
  setStep: (step: number) => void;
  form: EmployeeForm;
  setField: <K extends keyof EmployeeForm>(field: K, value: EmployeeForm[K]) => void;
  branches: Branch[];
  managers: Employee[];
  isAdmin: boolean;
  saving: boolean;
  editing: boolean;
  feedback: Feedback;
  fieldErrors: FieldErrors;
  onNext: () => void;
  onSelectStep: (step: number) => void;
  onSubmit: (event: FormEvent<HTMLFormElement>) => void;
}) {
  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent dir="rtl" className="z-[100] flex max-h-[88dvh] w-[calc(100vw-1.25rem)] max-w-2xl flex-col gap-0 overflow-hidden rounded-xl border-primary/15 bg-card p-0 font-sans shadow-card [&>button]:end-4 [&>button]:right-auto [&>button]:top-4">
        <DialogHeader className="border-b border-border bg-muted/25 px-5 py-4 pe-12 text-right sm:text-right">
          <DialogTitle className="font-kufi text-base font-normal leading-7">{editing ? "تعديل بيانات الموظف" : "إضافة موظف جديد"}</DialogTitle>
          <DialogDescription className="text-xs leading-6">أدخل بيانات الموظف على ثلاث خطوات متتالية</DialogDescription>
        </DialogHeader>

        <div className="shrink-0 px-4 pt-3 sm:px-5 sm:pt-4">
          <ol className="grid grid-cols-3 gap-2">
            {STEPS.map((item, index) => {
              const number = index + 1;
              const Icon = item.icon;
              const current = step === number;
              const done = step > number;
              return (
                <li key={item.label} className="min-w-0">
                  <Button type="button" variant="ghost" onClick={() => onSelectStep(number)} className={cn("flex h-auto w-full flex-col items-center gap-1 rounded-lg border px-1 py-2 transition-colors", current ? "border-primary/25 bg-primary/8 text-primary" : done ? "border-success/20 bg-success/5 text-success" : "border-border bg-background text-muted-foreground")}>
                    <span className="grid size-7 place-items-center rounded-full border border-current/20">{done ? <Check className="size-3.5" /> : <Icon className="size-3.5" />}</span>
                    <span className="truncate text-[10px] font-medium sm:text-xs">{item.label}</span>
                  </Button>
                </li>
              );
            })}
          </ol>
        </div>

        <form onSubmit={onSubmit} className="flex min-h-0 flex-1 flex-col">
          <div className="min-h-0 flex-1 overflow-y-auto px-4 py-4 sm:px-5">
            {step === 1 ? <EmploymentFields form={form} setField={setField} branches={branches} managers={managers} isAdmin={isAdmin} errors={fieldErrors} /> : null}
            {step === 2 ? <PersonalFields form={form} setField={setField} errors={fieldErrors} /> : null}
            {step === 3 ? <FinancialFields form={form} setField={setField} isAdmin={isAdmin} errors={fieldErrors} /> : null}
            {feedback?.kind === "error" ? <p className="mt-4 flex items-center gap-2 rounded-lg border border-destructive/20 bg-destructive/8 px-3 py-2 text-xs text-destructive"><CircleAlert className="size-4" />{feedback.message}</p> : null}
          </div>

          <div className="flex shrink-0 items-center justify-between gap-2 border-t border-border bg-muted/20 px-4 py-3 sm:px-5 sm:py-4">
            <Button type="button" variant="outline" onClick={() => step === 1 ? onOpenChange(false) : setStep(step - 1)}>{step === 1 ? "إلغاء" : <><ChevronRight />السابق</>}</Button>
            {step < 3 ? <Button type="button" onClick={onNext}>التالي<ChevronLeft /></Button> : <Button type="submit" disabled={saving}>{saving ? <LoaderCircle className="animate-spin" /> : <Check />}{editing ? "حفظ التعديلات" : "حفظ الموظف"}</Button>}
          </div>
        </form>
      </DialogContent>
    </Dialog>
  );
}

function EmploymentFields({ form, setField, branches, managers, isAdmin, errors }: { form: EmployeeForm; setField: <K extends keyof EmployeeForm>(field: K, value: EmployeeForm[K]) => void; branches: Branch[]; managers: Employee[]; isAdmin: boolean; errors: FieldErrors }) {
  return (
    <div className="grid gap-4 sm:grid-cols-2">
      <Field label="الرقم الوظيفي" hint="اتركه فارغاً للتوليد التلقائي"><Input dir="ltr" value={form.employeeNumber} onChange={(event) => setField("employeeNumber", event.target.value)} placeholder="تلقائي" className="h-11 text-right" /></Field>
      <Field label="البريد الإلكتروني العملي" required error={errors.workEmail}><Input dir="ltr" type="email" value={form.workEmail} onChange={(event) => setField("workEmail", event.target.value)} placeholder="name@company.com" aria-invalid={Boolean(errors.workEmail)} className="h-11 text-left" /></Field>
      <Field label="القسم" required error={errors.department}><Input value={form.department} onChange={(event) => setField("department", event.target.value)} placeholder="مثال: الموارد البشرية" aria-invalid={Boolean(errors.department)} className="h-11" /></Field>
      <Field label="المسمى الوظيفي" required error={errors.position}><Input value={form.position} onChange={(event) => setField("position", event.target.value)} placeholder="مثال: أخصائي موارد بشرية" aria-invalid={Boolean(errors.position)} className="h-11" /></Field>
      <Field label="المدير المباشر"><Select dir="rtl" value={form.managerId} onValueChange={(value) => setField("managerId", value)}><SelectTrigger className="h-11"><SelectValue placeholder="اختر المدير" /></SelectTrigger><SelectContent dir="rtl" position="popper" className="z-[200] max-h-64"><SelectItem value="none">بدون مدير مباشر</SelectItem>{managers.map((manager) => <SelectItem key={manager.id} value={manager.id}>{manager.full_name}</SelectItem>)}</SelectContent></Select></Field>
      <Field label="الفرع" required error={errors.branchId}><Select dir="rtl" value={form.branchId} onValueChange={(value) => setField("branchId", value)} disabled={!isAdmin}><SelectTrigger aria-invalid={Boolean(errors.branchId)} className="h-11"><SelectValue placeholder="اختر الفرع" /></SelectTrigger><SelectContent dir="rtl" position="popper" className="z-[200] max-h-64">{branches.map((branch) => <SelectItem key={branch.id} value={branch.id}>{branch.name}</SelectItem>)}</SelectContent></Select></Field>
      <Field label="تاريخ التعيين" required error={errors.hireDate}><GlassDatePicker ariaLabel="تاريخ التعيين" value={form.hireDate} onChange={(value) => setField("hireDate", value)} /></Field>
      <Field label="نوع الدوام" required><Select dir="rtl" value={form.employmentType} onValueChange={(value) => setField("employmentType", value)}><SelectTrigger className="h-11"><SelectValue /></SelectTrigger><SelectContent dir="rtl" position="popper" className="z-[200] max-h-64">{Object.entries(EMPLOYMENT_LABELS).map(([value, label]) => <SelectItem key={value} value={value}>{label}</SelectItem>)}</SelectContent></Select></Field>
    </div>
  );
}

function PersonalFields({ form, setField, errors }: { form: EmployeeForm; setField: <K extends keyof EmployeeForm>(field: K, value: EmployeeForm[K]) => void; errors: FieldErrors }) {
  return (
    <div className="grid gap-4 sm:grid-cols-2">
      <Field label="الاسم الكامل" required error={errors.fullName}><Input value={form.fullName} onChange={(event) => setField("fullName", event.target.value)} placeholder="الاسم الكامل" aria-invalid={Boolean(errors.fullName)} className="h-11" /></Field>
      <Field label="الاسم بالإنجليزية" hint="اختياري"><Input dir="ltr" value={form.fullNameEn} onChange={(event) => setField("fullNameEn", event.target.value)} placeholder="Full name" className="h-11 text-left" /></Field>
      <Field label="رقم الهوية / الجواز" required error={errors.nationalId}><Input dir="ltr" value={form.nationalId} onChange={(event) => setField("nationalId", event.target.value)} placeholder="رقم الهوية أو الجواز" aria-invalid={Boolean(errors.nationalId)} className="h-11 text-left" /></Field>
      <Field label="رقم الجوال" required error={errors.phone}>
        <div dir="ltr" className="relative">
          <span className="pointer-events-none absolute start-3 top-1/2 -translate-y-1/2 text-sm text-foreground">+967</span>
          <Input
            dir="ltr"
            type="tel"
            inputMode="numeric"
            value={form.phone.startsWith("+967") ? form.phone.slice(4) : form.phone.replace(/\D/g, "")}
            onChange={(event) => {
              const localNumber = event.target.value.replace(/\D/g, "").slice(0, 10);
              setField("phone", localNumber ? `+967${localNumber}` : "");
            }}
            placeholder=""
            aria-label="رقم الجوال بعد مفتاح اليمن +967"
            aria-invalid={Boolean(errors.phone)}
            className="h-11 ps-16 text-left"
          />
        </div>
      </Field>
      <Field label="تاريخ الميلاد" required error={errors.birthDate}><GlassDatePicker ariaLabel="تاريخ الميلاد" value={form.birthDate} onChange={(value) => setField("birthDate", value)} /></Field>
      <Field label="الجنس" required error={errors.gender}><Select dir="rtl" value={form.gender} onValueChange={(value) => setField("gender", value)}><SelectTrigger aria-invalid={Boolean(errors.gender)} className="h-11"><SelectValue placeholder="اختر الجنس" /></SelectTrigger><SelectContent dir="rtl" position="popper" className="z-[200] max-h-64"><SelectItem value="male">ذكر</SelectItem><SelectItem value="female">أنثى</SelectItem></SelectContent></Select></Field>
      <Field label="الجنسية" required error={errors.nationality} className="sm:col-span-2"><Input value={form.nationality} onChange={(event) => setField("nationality", event.target.value)} placeholder="الجنسية" aria-invalid={Boolean(errors.nationality)} className="h-11" /></Field>
    </div>
  );
}

function FinancialFields({ form, setField, isAdmin, errors }: { form: EmployeeForm; setField: <K extends keyof EmployeeForm>(field: K, value: EmployeeForm[K]) => void; isAdmin: boolean; errors: FieldErrors }) {
  if (!isAdmin) return <div className="grid min-h-52 place-items-center rounded-xl border border-dashed border-primary/20 bg-primary/5 px-6 text-center"><div><WalletCards className="mx-auto mb-3 size-9 text-primary" /><p className="font-medium">البيانات المالية محمية</p><p className="mt-1 text-sm leading-6 text-muted-foreground">يمكن للمدير فقط إدخال الراتب والبدلات. يمكنك حفظ الموظف الآن وسيضيف المدير بياناته المالية لاحقاً.</p></div></div>;
  return (
    <div className="grid gap-4 sm:grid-cols-2">
      <Field label="الراتب الأساسي" required error={errors.baseSalary}><MoneyInput value={form.baseSalary} onChange={(value) => setField("baseSalary", value)} invalid={Boolean(errors.baseSalary)} /></Field>
      <Field label="بدل السكن" required error={errors.housingAllowance}><MoneyInput value={form.housingAllowance} onChange={(value) => setField("housingAllowance", value)} invalid={Boolean(errors.housingAllowance)} /></Field>
      <Field label="بدل النقل" required error={errors.transportAllowance}><MoneyInput value={form.transportAllowance} onChange={(value) => setField("transportAllowance", value)} invalid={Boolean(errors.transportAllowance)} /></Field>
      <Field label="اسم البنك" required error={errors.bankName}><Input value={form.bankName} onChange={(event) => setField("bankName", event.target.value)} placeholder="اسم البنك" aria-invalid={Boolean(errors.bankName)} className="h-11" /></Field>
    </div>
  );
}

function Field({ label, hint, required, error, className, children }: { label: string; hint?: string | undefined; required?: boolean | undefined; error?: string | undefined; className?: string | undefined; children: ReactNode }) {
  return <div className={cn("space-y-1.5", className)}><div className="flex items-center justify-between gap-2"><Label className="text-xs font-medium">{label}</Label>{required ? <span className="text-[10px] text-muted-foreground">مطلوب</span> : null}</div>{children}{error ? <p className="text-[11px] leading-5 text-destructive">{error}</p> : hint ? <p className="text-[11px] text-muted-foreground">{hint}</p> : null}</div>;
}

function MoneyInput({ value, onChange, invalid }: { value: string; onChange: (value: string) => void; invalid?: boolean }) {
  return <div className="relative"><Input dir="ltr" type="number" min="0" step="0.01" value={value} onChange={(event) => onChange(event.target.value)} placeholder="" aria-invalid={invalid} className="h-11 pe-14 text-left" /><span className="absolute end-3 top-1/2 -translate-y-1/2 text-xs text-muted-foreground">ر.ي</span></div>;
}

function EmployeeDetails({ employee, open, onOpenChange }: { employee: Employee | null; open: boolean; onOpenChange: (open: boolean) => void }) {
  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent dir="rtl" className="w-[calc(100vw-1.5rem)] max-w-md rounded-xl font-sans">
        <DialogHeader className="text-right sm:text-right"><DialogTitle className="font-kufi text-base font-normal leading-7">ملف الموظف</DialogTitle><DialogDescription>بيانات الموظف الوظيفية والشخصية</DialogDescription></DialogHeader>
        {employee ? <div className="space-y-4"><div className="flex items-center gap-3 rounded-lg border bg-muted/25 p-3"><EmployeeAvatar name={employee.full_name} /><div><p className="font-medium">{employee.full_name}</p><p dir="ltr" className="text-left text-xs text-muted-foreground">{employee.employee_number}</p></div></div><dl className="grid grid-cols-2 gap-3 text-sm"><Detail label="القسم" value={employee.department} /><Detail label="المسمى" value={employee.position} /><Detail label="نوع الدوام" value={EMPLOYMENT_LABELS[employee.employment_type]} /><Detail label="تاريخ التعيين" value={formatArabicDate(employee.hire_date)} /><Detail label="البريد العملي" value={employee.work_email} /><Detail label="الهاتف" value={employee.phone} /></dl></div> : null}
      </DialogContent>
    </Dialog>
  );
}

function Detail({ label, value }: { label: string; value: string | null | undefined }) {
  return <div className="min-w-0 rounded-lg border border-border/70 p-3"><dt className="text-xs text-muted-foreground">{label}</dt><dd className="mt-1 truncate font-medium">{value || "—"}</dd></div>;
}

function formatArabicDate(value: string | null) {
  if (!value) return "—";
  return new Intl.DateTimeFormat("ar-YE-u-nu-latn", { year: "numeric", month: "short", day: "numeric" }).format(new Date(`${value}T12:00:00`));
}