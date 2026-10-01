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

import { tr, trf, getLocale } from "@/lib/i18n";
import { ExportMenu } from "@/components/export-menu";
export const Route = createFileRoute("/_authenticated/employees")({
  head: () => ({
    meta: [
      { title: tr("إدارة الموظفين | نظام الموارد البشرية") },
      { name: "description", content: tr("البحث وإدارة أعضاء الفريق وبياناتهم الوظيفية") },
      { property: "og:title", content: tr("إدارة الموظفين | نظام الموارد البشرية") },
      { property: "og:description", content: tr("البحث وإدارة أعضاء الفريق وبياناتهم الوظيفية") },
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
  workEmail: z.string().trim().email(tr("أدخل بريداً عملياً صحيحاً")).max(255),
  department: z.string().trim().min(1, tr("القسم مطلوب")).max(100),
  position: z.string().trim().min(1, tr("المسمى الوظيفي مطلوب")).max(100),
  branchId: z.string().uuid(tr("اختر الفرع")),
  hireDate: z.string().date(tr("اختر تاريخ التعيين")),
});

const personalSchema = z.object({
  fullName: z.string().trim().min(3, tr("أدخل الاسم الكامل")).max(150),
  nationalId: z.string().trim().min(5, tr("أدخل رقم هوية أو جواز صحيحاً")).max(30).regex(/^[\p{L}\p{N}-]+$/u, tr("استخدم الحروف والأرقام والشرطة فقط")),
  phone: z.string().trim().regex(/^\+?[0-9\s-]{7,18}$/, tr("أدخل رقم جوال صحيحاً")),
  birthDate: z.string().date(tr("اختر تاريخ الميلاد")).refine((value) => new Date(`${value}T12:00:00`) < new Date(), tr("تاريخ الميلاد يجب أن يكون في الماضي")),
  gender: z.enum(["male", "female"], { message: tr("اختر الجنس") }),
  nationality: z.string().trim().min(2, tr("الجنسية مطلوبة")).max(80),
});

const financialSchema = z.object({
  baseSalary: z.string().trim().min(1, tr("أدخل الراتب الأساسي")).transform(Number).refine((value) => Number.isFinite(value) && value >= 0, tr("لا يمكن أن يكون الراتب سالباً")),
  housingAllowance: z.string().trim().min(1, tr("أدخل بدل السكن أو صفراً")).transform(Number).refine((value) => Number.isFinite(value) && value >= 0, tr("لا يمكن أن يكون بدل السكن سالباً")),
  transportAllowance: z.string().trim().min(1, tr("أدخل بدل النقل أو صفراً")).transform(Number).refine((value) => Number.isFinite(value) && value >= 0, tr("لا يمكن أن يكون بدل النقل سالباً")),
  bankName: z.string().trim().min(2, tr("اسم البنك مطلوب")).max(100),
});

const EMPLOYMENT_LABELS: Record<string, string> = {
  full_time: tr("دوام كامل"),
  part_time: tr("دوام جزئي"),
  remote: tr("عن بُعد"),
};

const STEPS = [
  { label: tr("البيانات الوظيفية"), icon: BriefcaseBusiness },
  { label: tr("البيانات الشخصية"), icon: UserRound },
  { label: tr("البيانات المالية"), icon: WalletCards },
];

function EmployeesPage() {
  const { role, isAdmin, loading: roleLoading } = useCurrentUser();
  const [employees, setEmployees] = useState<Employee[]>([]);
  const [branches, setBranches] = useState<Branch[]>([]);
  const [myBranchId, setMyBranchId] = useState("");
  const [customDepartments, setCustomDepartments] = useState<string[]>([]);
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
      setFeedback({ kind: "error", message: tr("تعذّر تحميل بيانات الموظفين. حاول مرة أخرى.") });
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
    () => Array.from(new Set([
      ...employees.map((employee) => employee.department).filter((value): value is string => Boolean(value)),
      ...customDepartments,
    ])).sort(),
    [customDepartments, employees],
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
      setFeedback({ kind: "error", message: tr("راجع الحقول الموضحة قبل المتابعة") });
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
      setFeedback({ kind: "error", message: tr("راجع الحقول الموضحة قبل حفظ الموظف") });
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
        setFeedback({ kind: "error", message: result.error.code === "23505" ? tr("الرقم الوظيفي أو البريد أو الهوية مستخدم مسبقاً") : tr("تعذّر تحديث بيانات الموظف") });
        return;
      }
    } else {
      const result = await supabase.from("employees").insert(employeePayload).select("id").single();
      if (result.error) {
        setSaving(false);
        setFeedback({ kind: "error", message: result.error.code === "23505" ? tr("الرقم الوظيفي أو البريد أو الهوية مستخدم مسبقاً") : tr("تعذّر إضافة الموظف. تحقق من الفرع والصلاحيات.") });
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
        setFeedback({ kind: "error", message: tr("حُفظ الموظف، لكن تعذّر حفظ بياناته المالية") });
        await loadData();
        return;
      }
    }

    setSaving(false);
    setWizardOpen(false);
    setFeedback({ kind: "success", message: editingId ? tr("تم تحديث بيانات الموظف بنجاح") : tr("تمت إضافة الموظف بنجاح") });
    await loadData();
  }

  async function deleteEmployee() {
    if (!selected || !isAdmin) return;
    const result = await supabase.from("employees").delete().eq("id", selected.id);
    setDeleteOpen(false);
    if (result.error) {
      setFeedback({ kind: "error", message: tr("تعذّر حذف الموظف لوجود سجلات مرتبطة به") });
      return;
    }
    setFeedback({ kind: "success", message: tr("تم حذف الموظف") });
    setSelected(null);
    await loadData();
  }

  async function createBranch(name: string) {
    const result = await supabase.from("branches").insert({ name }).select("id,name").single();
    if (result.error || !result.data) return null;
    const branch = result.data as Branch;
    setBranches((current) => [...current, branch].sort((a, b) => a.name.localeCompare(b.name, "ar")));
    return branch.id;
  }

  function createDepartment(name: string) {
    setCustomDepartments((current) => (current.includes(name) ? current : [...current, name]));
  }

  async function createManager(name: string) {
    if (!form.branchId) return null;
    const result = await supabase
      .from("employees")
      .insert({ full_name: name, branch_id: form.branchId })
      .select("id,employee_number,full_name,full_name_en,work_email,department,position,manager_id,hire_date,employment_type,national_id,birth_date,nationality,gender,phone,status,branch_id")
      .single();
    if (result.error || !result.data) return null;
    const manager = result.data as Employee;
    setEmployees((current) => [manager, ...current]);
    return manager.id;
  }



  return (
    <section className="mx-auto w-full max-w-6xl space-y-4 font-sans text-foreground" aria-labelledby="employees-heading">
      <div className="flex items-center justify-between gap-3">
        <div className="min-w-0">
          <p className="text-xs text-muted-foreground">{tr("دليل الفريق")}</p>
          <h2 id="employees-heading" className="truncate text-xl font-semibold leading-relaxed">{tr("إدارة الموظفين")}</h2>
        </div>
        <div className="flex shrink-0 items-center gap-2">
        <ExportMenu
          build={() => ({
            fileName: tr("الموظفون"),
            tables: [{
              title: tr("الموظفون"),
              columns: [tr("رقم الموظف"), tr("الاسم"), tr("القسم"), tr("المسمى الوظيفي"), tr("تاريخ التعيين"), tr("نوع التوظيف"), tr("الحالة"), tr("الجوال")],
              rows: filteredEmployees.map((e) => [e.employee_number, e.full_name, e.department, e.position, e.hire_date, EMPLOYMENT_LABELS[e.employment_type] ?? e.employment_type, e.status === "active" ? tr("نشط") : tr("غير نشط"), e.phone]),
            }],
          })}
        />
        {!roleLoading && canWrite ? (
          <Button type="button" onClick={openCreate} className="h-11 shrink-0 rounded-lg bg-primary px-3 text-primary-foreground shadow-nav hover:bg-primary/90 sm:px-4">
            <Plus aria-hidden />
            <span className="hidden sm:inline">{tr("إضافة موظف جديد")}</span>
            <span className="sm:hidden">{tr("إضافة موظف")}</span>
          </Button>
        ) : null}
        </div>
      </div>

      {feedback ? (
        <div className={cn("flex items-center gap-2 rounded-lg border px-3 py-2.5 text-sm", feedback.kind === "success" ? "border-success/25 bg-success/10 text-success" : "border-destructive/25 bg-destructive/10 text-destructive")}>
          {feedback.kind === "success" ? <Check className="size-4" /> : <CircleAlert className="size-4" />}
          <span className="flex-1">{feedback.message}</span>
          <Button type="button" size="icon-sm" variant="ghost" aria-label={tr("إخفاء الرسالة")} onClick={() => setFeedback(null)}><X /></Button>
        </div>
      ) : null}

      <div className="rounded-lg border border-primary/10 bg-card/90 p-3 shadow-card backdrop-blur-xl">
        <div className="relative">
          <Search className="pointer-events-none absolute end-3 top-1/2 size-4 -translate-y-1/2 text-muted-foreground" aria-hidden />
          <Input
            value={search}
            onChange={(event) => setSearch(event.target.value)}
            placeholder={tr("البحث بالاسم أو الرقم الوظيفي")}
            aria-label={tr("البحث بالاسم أو الرقم الوظيفي")}
            className="h-11 rounded-lg border-primary/10 bg-background pe-10 shadow-none"
          />
        </div>
        <div className="mt-3 grid grid-cols-1 gap-2 min-[420px]:grid-cols-3">
          <FilterSelect label={tr("القسم")} value={department} onChange={setDepartment} options={departments.map((item) => ({ value: item, label: item }))} />
          <FilterSelect label={tr("الحالة")} value={status} onChange={setStatus} options={[{ value: "active", label: tr("نشط") }, { value: "inactive", label: tr("مستقيل") }]} />
          <FilterSelect label={tr("نوع الدوام")} value={employmentType} onChange={setEmploymentType} options={Object.entries(EMPLOYMENT_LABELS).map(([value, label]) => ({ value, label }))} />
        </div>
      </div>

      <div className="overflow-hidden rounded-lg border border-border bg-card shadow-card">
        <div className="flex items-center justify-between border-b border-border px-4 py-3">
          <p className="text-sm font-medium">{tr("الموظفون")}</p>
          <span className="rounded-full bg-primary/8 px-2.5 py-1 text-xs font-medium text-primary">{filteredEmployees.length} {tr("موظف")}</span>
        </div>
        {loading ? (
          <div className="grid min-h-56 place-items-center"><LoaderCircle className="size-6 animate-spin text-primary" aria-label={tr("جارٍ تحميل الموظفين")} /></div>
        ) : filteredEmployees.length === 0 ? (
          <div className="grid min-h-56 place-items-center px-6 text-center">
            <div><UserRound className="mx-auto mb-3 size-9 text-muted-foreground/60" /><p className="text-sm font-medium">{employees.length ? tr("لا توجد نتائج مطابقة") : tr("لا يوجد موظفون بعد")}</p><p className="mt-1 text-xs text-muted-foreground">{employees.length ? tr("جرّب تغيير البحث أو الفلاتر") : tr("أضف أول موظف لبدء بناء دليل الفريق")}</p>{employees.length ? <Button type="button" variant="outline" size="sm" className="mt-3" onClick={() => { setSearch(""); setDepartment("all"); setStatus("all"); setEmploymentType("all"); }}>{tr("مسح البحث والفلاتر")}</Button> : null}</div>
          </div>
        ) : (
          <Table>
            <TableHeader className="bg-muted/45">
              <TableRow className="hover:bg-transparent">
                <TableHead className="min-w-52 text-start">{tr("الصورة والاسم الكامل")}</TableHead>
                <TableHead className="min-w-28 text-start">{tr("الرقم الوظيفي")}</TableHead>
                <TableHead className="min-w-32 text-start">{tr("القسم")}</TableHead>
                <TableHead className="min-w-40 text-start">{tr("المسمى الوظيفي")}</TableHead>
                <TableHead className="min-w-32 text-start">{tr("تاريخ التعيين")}</TableHead>
                <TableHead className="min-w-24 text-start">{tr("الحالة")}</TableHead>
                <TableHead className="w-20 text-center">{tr("إجراءات")}</TableHead>
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
                  <TableCell dir="ltr" className="text-start font-medium text-primary">{employee.employee_number}</TableCell>
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
        departments={departments}
        onCreateBranch={createBranch}
        onCreateDepartment={createDepartment}
        onCreateManager={createManager}
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
        <AlertDialogContent className="w-[calc(100vw-2rem)] max-w-sm rounded-xl font-sans">
          <AlertDialogHeader className="text-start sm:text-start">
            <AlertDialogTitle>{tr("حذف الموظف")}</AlertDialogTitle>
            <AlertDialogDescription>{tr("سيُحذف سجل")} {selected?.full_name} {tr("نهائياً. لا يمكن التراجع عن هذه الخطوة.")}</AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter className="gap-2 sm:space-x-0">
            <AlertDialogCancel>{tr("إلغاء")}</AlertDialogCancel>
            <AlertDialogAction onClick={() => void deleteEmployee()} className="bg-destructive text-destructive-foreground hover:bg-destructive/90">{tr("حذف")}</AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </section>
  );
}

function FilterSelect({ label, value, onChange, options }: { label: string; value: string; onChange: (value: string) => void; options: { value: string; label: string }[] }) {
  return (
    <Select value={value} onValueChange={onChange}>
      <SelectTrigger className="h-10 rounded-lg border-primary/10 bg-background"><SelectValue placeholder={label} /></SelectTrigger>
      <SelectContent position="popper" className="z-[120] max-h-64"><SelectItem value="all">{tr("كل")} {label === tr("القسم") ? tr("الأقسام") : label === tr("الحالة") ? tr("الحالات") : tr("أنواع الدوام")}</SelectItem>{options.map((option) => <SelectItem key={option.value} value={option.value}>{option.label}</SelectItem>)}</SelectContent>
    </Select>
  );
}

function EmployeeAvatar({ name }: { name: string }) {
  const initials = name.split(" ").filter(Boolean).slice(0, 2).map((part) => part[0]).join("");
  return <span className="grid size-10 shrink-0 place-items-center rounded-full border border-primary/15 bg-primary/8 text-sm font-semibold text-primary shadow-sm">{initials}</span>;
}

function StatusBadge({ status }: { status: string }) {
  const active = status === "active";
  return <span className={cn("inline-flex items-center gap-1.5 rounded-full border px-2.5 py-1 text-xs font-medium", active ? "border-success/20 bg-success/10 text-success" : "border-destructive/15 bg-muted text-muted-foreground")}><span className={cn("size-1.5 rounded-full", active ? "bg-success" : "bg-muted-foreground")} />{active ? tr("نشط") : tr("مستقيل")}</span>;
}

function EmployeeActions({ employee, canEdit, canDelete, onView, onEdit, onDelete }: { employee: Employee; canEdit: boolean; canDelete: boolean; onView: () => void; onEdit: () => void; onDelete: () => void }) {
  return (
    <DropdownMenu>
      <DropdownMenuTrigger asChild><Button type="button" variant="ghost" size="icon" aria-label={trf("إجراءات {0}", employee.full_name)}><MoreHorizontal /></Button></DropdownMenuTrigger>
      <DropdownMenuContent align="end" className="w-40">
        <DropdownMenuItem onSelect={onView}><Eye />{tr("عرض الملف")}</DropdownMenuItem>
        {canEdit ? <DropdownMenuItem onSelect={onEdit}><Pencil />{tr("تعديل")}</DropdownMenuItem> : null}
        {canDelete ? <DropdownMenuItem onSelect={onDelete} className="text-destructive focus:text-destructive"><Trash2 />{tr("حذف")}</DropdownMenuItem> : null}
      </DropdownMenuContent>
    </DropdownMenu>
  );
}

function EmployeeWizard({ open, onOpenChange, step, setStep, form, setField, branches, managers, departments, isAdmin, saving, editing, feedback, fieldErrors, onNext, onSelectStep, onSubmit, onCreateBranch, onCreateDepartment, onCreateManager }: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  step: number;
  setStep: (step: number) => void;
  form: EmployeeForm;
  setField: <K extends keyof EmployeeForm>(field: K, value: EmployeeForm[K]) => void;
  branches: Branch[];
  managers: Employee[];
  departments: string[];
  onCreateBranch: (name: string) => Promise<string | null>;
  onCreateDepartment: (name: string) => void;
  onCreateManager: (name: string) => Promise<string | null>;
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
      <DialogContent className="z-[100] flex max-h-[88dvh] w-[calc(100vw-1.25rem)] max-w-2xl flex-col gap-0 overflow-hidden rounded-xl border-primary/15 bg-card p-0 font-sans shadow-card">
        <DialogHeader className="border-b border-border bg-muted/25 px-5 py-4 pe-12 text-start sm:text-start">
          <DialogTitle className="font-kufi text-base font-normal leading-7">{editing ? tr("تعديل بيانات الموظف") : tr("إضافة موظف جديد")}</DialogTitle>
          <DialogDescription className="text-xs leading-6">{tr("أدخل بيانات الموظف على ثلاث خطوات متتالية")}</DialogDescription>
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
            {step === 1 ? <EmploymentFields form={form} setField={setField} branches={branches} managers={managers} departments={departments} isAdmin={isAdmin} errors={fieldErrors} onCreateBranch={onCreateBranch} onCreateDepartment={onCreateDepartment} onCreateManager={onCreateManager} /> : null}
            {step === 2 ? <PersonalFields form={form} setField={setField} errors={fieldErrors} /> : null}
            {step === 3 ? <FinancialFields form={form} setField={setField} isAdmin={isAdmin} errors={fieldErrors} /> : null}
            {feedback?.kind === "error" ? <p className="mt-4 flex items-center gap-2 rounded-lg border border-destructive/20 bg-destructive/8 px-3 py-2 text-xs text-destructive"><CircleAlert className="size-4" />{feedback.message}</p> : null}
          </div>

          <div className="flex shrink-0 items-center justify-between gap-2 border-t border-border bg-muted/20 px-4 py-3 sm:px-5 sm:py-4">
            <Button type="button" variant="outline" onClick={() => step === 1 ? onOpenChange(false) : setStep(step - 1)}>{step === 1 ? tr("إلغاء") : <><ChevronRight />{tr("السابق")}</>}</Button>
            {step < 3 ? <Button type="button" onClick={onNext}>{tr("التالي")}<ChevronLeft /></Button> : <Button type="submit" disabled={saving}>{saving ? <LoaderCircle className="animate-spin" /> : <Check />}{editing ? tr("حفظ التعديلات") : tr("حفظ الموظف")}</Button>}
          </div>
        </form>
      </DialogContent>
    </Dialog>
  );
}

const ADD_VALUE = "__add_new__";

type QuickAddKind = "branch" | "department" | "manager";

const QUICK_ADD_LABELS: Record<QuickAddKind, { title: string; field: string; trigger: string }> = {
  branch: { title: tr("إضافة فرع جديد"), field: tr("اسم الفرع الجديد"), trigger: tr("+ إضافة فرع جديد") },
  department: { title: tr("إضافة قسم جديد"), field: tr("اسم القسم الجديد"), trigger: tr("+ إضافة قسم جديد") },
  manager: { title: tr("إضافة مدير مباشر"), field: tr("اسم المدير المباشر"), trigger: tr("+ إضافة مدير مباشر") },
};

function EmploymentFields({ form, setField, branches, managers, departments, isAdmin, errors, onCreateBranch, onCreateDepartment, onCreateManager }: {
  form: EmployeeForm;
  setField: <K extends keyof EmployeeForm>(field: K, value: EmployeeForm[K]) => void;
  branches: Branch[];
  managers: Employee[];
  departments: string[];
  isAdmin: boolean;
  errors: FieldErrors;
  onCreateBranch: (name: string) => Promise<string | null>;
  onCreateDepartment: (name: string) => void;
  onCreateManager: (name: string) => Promise<string | null>;
}) {
  const [quickAdd, setQuickAdd] = useState<QuickAddKind | null>(null);
  const [quickName, setQuickName] = useState("");
  const [quickSaving, setQuickSaving] = useState(false);
  const [quickError, setQuickError] = useState("");

  function openQuickAdd(kind: QuickAddKind) {
    setQuickAdd(kind);
    setQuickName("");
    setQuickError("");
  }

  async function submitQuickAdd() {
    const name = quickName.trim();
    if (name.length < 2) {
      setQuickError(tr("أدخل اسماً صحيحاً"));
      return;
    }
    setQuickSaving(true);
    if (quickAdd === "department") {
      onCreateDepartment(name);
      setField("department", name);
    } else if (quickAdd === "branch") {
      const id = await onCreateBranch(name);
      if (!id) {
        setQuickSaving(false);
        setQuickError(tr("تعذّر إضافة الفرع. تأكد من صلاحياتك."));
        return;
      }
      setField("branchId", id);
    } else if (quickAdd === "manager") {
      const id = await onCreateManager(name);
      if (!id) {
        setQuickSaving(false);
        setQuickError(tr("اختر الفرع أولاً ثم أضف المدير."));
        return;
      }
      setField("managerId", id);
    }
    setQuickSaving(false);
    setQuickAdd(null);
  }

  const addRowClass = "mt-1 cursor-pointer justify-center rounded-md border border-dashed border-primary/40 bg-primary/5 py-2 text-center text-xs font-medium text-primary";

  return (
    <div className="grid gap-4 sm:grid-cols-2">
      <Field label={tr("الرقم الوظيفي")} hint={tr("يولّده النظام تلقائياً عند الحفظ")}>
        <div className="flex h-11 items-center justify-between rounded-md border border-input bg-muted/40 px-3 text-sm text-muted-foreground">
          <span>{form.employeeNumber || tr("تلقائي")}</span>
          <span className="text-[10px]">{tr("غير قابل للتعديل")}</span>
        </div>
      </Field>
      <Field label={tr("البريد الإلكتروني العملي")} required error={errors.workEmail}><Input dir="ltr" type="email" value={form.workEmail} onChange={(event) => setField("workEmail", event.target.value)} placeholder="name@company.com" aria-invalid={Boolean(errors.workEmail)} className="h-11 text-left" /></Field>
      <Field label={tr("القسم")} required error={errors.department}>
        <Select value={form.department} onValueChange={(value) => value === ADD_VALUE ? openQuickAdd("department") : setField("department", value)}>
          <SelectTrigger aria-invalid={Boolean(errors.department)} className="h-11"><SelectValue placeholder={tr("اختر القسم")} /></SelectTrigger>
          <SelectContent position="popper" className="z-[200] max-h-64">
            {departments.map((item) => <SelectItem key={item} value={item}>{item}</SelectItem>)}
            <SelectItem value={ADD_VALUE} className={addRowClass}>{QUICK_ADD_LABELS.department.trigger}</SelectItem>
          </SelectContent>
        </Select>
      </Field>
      <Field label={tr("المسمى الوظيفي")} required error={errors.position}><Input value={form.position} onChange={(event) => setField("position", event.target.value)} placeholder={tr("مثال: أخصائي موارد بشرية")} aria-invalid={Boolean(errors.position)} className="h-11" /></Field>
      <Field label={tr("المدير المباشر")}>
        <Select value={form.managerId} onValueChange={(value) => value === ADD_VALUE ? openQuickAdd("manager") : setField("managerId", value)}>
          <SelectTrigger className="h-11"><SelectValue placeholder={tr("اختر المدير")} /></SelectTrigger>
          <SelectContent position="popper" className="z-[200] max-h-64">
            <SelectItem value="none">{tr("بدون مدير مباشر")}</SelectItem>
            {managers.map((manager) => <SelectItem key={manager.id} value={manager.id}>{manager.full_name}</SelectItem>)}
            <SelectItem value={ADD_VALUE} className={addRowClass}>{QUICK_ADD_LABELS.manager.trigger}</SelectItem>
          </SelectContent>
        </Select>
      </Field>
      <Field label={tr("الفرع")} required error={errors.branchId}>
        <Select value={form.branchId} onValueChange={(value) => value === ADD_VALUE ? openQuickAdd("branch") : setField("branchId", value)} disabled={!isAdmin}>
          <SelectTrigger aria-invalid={Boolean(errors.branchId)} className="h-11"><SelectValue placeholder={tr("اختر الفرع")} /></SelectTrigger>
          <SelectContent position="popper" className="z-[200] max-h-64">
            {branches.map((branch) => <SelectItem key={branch.id} value={branch.id}>{branch.name}</SelectItem>)}
            <SelectItem value={ADD_VALUE} className={addRowClass}>{QUICK_ADD_LABELS.branch.trigger}</SelectItem>
          </SelectContent>
        </Select>
      </Field>
      <Field label={tr("تاريخ التعيين")} required error={errors.hireDate}><GlassDatePicker ariaLabel={tr("تاريخ التعيين")} value={form.hireDate} onChange={(value) => setField("hireDate", value)} /></Field>
      <Field label={tr("نوع الدوام")} required><Select value={form.employmentType} onValueChange={(value) => setField("employmentType", value)}><SelectTrigger className="h-11"><SelectValue /></SelectTrigger><SelectContent position="popper" className="z-[200] max-h-64">{Object.entries(EMPLOYMENT_LABELS).map(([value, label]) => <SelectItem key={value} value={value}>{label}</SelectItem>)}</SelectContent></Select></Field>

      <Dialog open={quickAdd !== null} onOpenChange={(open) => { if (!open) setQuickAdd(null); }}>
        <DialogContent className="z-[300] w-[calc(100vw-2.5rem)] max-w-sm rounded-xl font-sans">
          <DialogHeader className="text-start sm:text-start">
            <DialogTitle className="font-kufi text-base font-normal leading-7">{quickAdd ? QUICK_ADD_LABELS[quickAdd].title : ""}</DialogTitle>
            <DialogDescription className="text-xs">{tr("سيُضاف مباشرة إلى خيارات النظام ويُحدد في النموذج")}</DialogDescription>
          </DialogHeader>
          <div className="space-y-2">
            <Label className="text-xs font-medium">{quickAdd ? QUICK_ADD_LABELS[quickAdd].field : ""}</Label>
            <Input value={quickName} onChange={(event) => { setQuickName(event.target.value); setQuickError(""); }} className="h-11" autoFocus />
            {quickError ? <p className="text-[11px] text-destructive">{quickError}</p> : null}
          </div>
          <div className="flex justify-end gap-2">
            <Button type="button" variant="outline" onClick={() => setQuickAdd(null)}>{tr("إلغاء")}</Button>
            <Button type="button" onClick={() => void submitQuickAdd()} disabled={quickSaving}>{quickSaving ? <LoaderCircle className="animate-spin" /> : <Plus />}{tr("إضافة وحفظ")}</Button>
          </div>
        </DialogContent>
      </Dialog>
    </div>
  );
}

function PersonalFields({ form, setField, errors }: { form: EmployeeForm; setField: <K extends keyof EmployeeForm>(field: K, value: EmployeeForm[K]) => void; errors: FieldErrors }) {
  return (
    <div className="grid gap-4 sm:grid-cols-2">
      <Field label={tr("الاسم الكامل")} required error={errors.fullName}><Input value={form.fullName} onChange={(event) => setField("fullName", event.target.value)} placeholder={tr("الاسم الكامل")} aria-invalid={Boolean(errors.fullName)} className="h-11" /></Field>
      <Field label={tr("الاسم بالإنجليزية")} hint={tr("اختياري")}><Input dir="ltr" value={form.fullNameEn} onChange={(event) => setField("fullNameEn", event.target.value)} placeholder="Full name" className="h-11 text-left" /></Field>
      <Field label={tr("رقم الهوية / الجواز")} required error={errors.nationalId}><Input dir="ltr" value={form.nationalId} onChange={(event) => setField("nationalId", event.target.value)} placeholder={tr("رقم الهوية أو الجواز")} aria-invalid={Boolean(errors.nationalId)} className="h-11 text-left" /></Field>
      <Field label={tr("رقم الجوال")} required error={errors.phone}>
        <Input
          dir="ltr"
          type="tel"
          inputMode="tel"
          value={form.phone}
          onChange={(event) => setField("phone", event.target.value.replace(/[^\d+\s-]/g, ""))}
          placeholder=""
          aria-label={tr("رقم الجوال")}
          aria-invalid={Boolean(errors.phone)}
          className="h-11 text-left"
        />
      </Field>
      <Field label={tr("تاريخ الميلاد")} required error={errors.birthDate}><GlassDatePicker ariaLabel={tr("تاريخ الميلاد")} value={form.birthDate} onChange={(value) => setField("birthDate", value)} /></Field>
      <Field label={tr("الجنس")} required error={errors.gender}><Select value={form.gender} onValueChange={(value) => setField("gender", value)}><SelectTrigger aria-invalid={Boolean(errors.gender)} className="h-11"><SelectValue placeholder={tr("اختر الجنس")} /></SelectTrigger><SelectContent position="popper" className="z-[200] max-h-64"><SelectItem value="male">{tr("ذكر")}</SelectItem><SelectItem value="female">{tr("أنثى")}</SelectItem></SelectContent></Select></Field>
      <Field label={tr("الجنسية")} required error={errors.nationality} className="sm:col-span-2"><Input value={form.nationality} onChange={(event) => setField("nationality", event.target.value)} placeholder={tr("الجنسية")} aria-invalid={Boolean(errors.nationality)} className="h-11" /></Field>
    </div>
  );
}

function FinancialFields({ form, setField, isAdmin, errors }: { form: EmployeeForm; setField: <K extends keyof EmployeeForm>(field: K, value: EmployeeForm[K]) => void; isAdmin: boolean; errors: FieldErrors }) {
  if (!isAdmin) return <div className="grid min-h-52 place-items-center rounded-xl border border-dashed border-primary/20 bg-primary/5 px-6 text-center"><div><WalletCards className="mx-auto mb-3 size-9 text-primary" /><p className="font-medium">{tr("البيانات المالية محمية")}</p><p className="mt-1 text-sm leading-6 text-muted-foreground">{tr("يمكن للمدير فقط إدخال الراتب والبدلات. يمكنك حفظ الموظف الآن وسيضيف المدير بياناته المالية لاحقاً.")}</p></div></div>;
  return (
    <div className="grid gap-4 sm:grid-cols-2">
      <Field label={tr("الراتب الأساسي")} required error={errors.baseSalary}><MoneyInput value={form.baseSalary} onChange={(value) => setField("baseSalary", value)} invalid={Boolean(errors.baseSalary)} /></Field>
      <Field label={tr("بدل السكن")} required error={errors.housingAllowance}><MoneyInput value={form.housingAllowance} onChange={(value) => setField("housingAllowance", value)} invalid={Boolean(errors.housingAllowance)} /></Field>
      <Field label={tr("بدل النقل")} required error={errors.transportAllowance}><MoneyInput value={form.transportAllowance} onChange={(value) => setField("transportAllowance", value)} invalid={Boolean(errors.transportAllowance)} /></Field>
      <Field label={tr("اسم البنك")} required error={errors.bankName}><Input value={form.bankName} onChange={(event) => setField("bankName", event.target.value)} placeholder={tr("اسم البنك")} aria-invalid={Boolean(errors.bankName)} className="h-11" /></Field>
    </div>
  );
}

function Field({ label, hint, required, error, className, children }: { label: string; hint?: string | undefined; required?: boolean | undefined; error?: string | undefined; className?: string | undefined; children: ReactNode }) {
  return <div className={cn("space-y-1.5", className)}><div className="flex items-center justify-between gap-2"><Label className="text-xs font-medium">{label}</Label>{required ? <span className="text-[10px] text-muted-foreground">{tr("مطلوب")}</span> : null}</div>{children}{error ? <p className="text-[11px] leading-5 text-destructive">{error}</p> : hint ? <p className="text-[11px] text-muted-foreground">{hint}</p> : null}</div>;
}

function MoneyInput({ value, onChange, invalid }: { value: string; onChange: (value: string) => void; invalid?: boolean }) {
  return <div className="relative"><Input dir="ltr" type="number" min="0" step="0.01" value={value} onChange={(event) => onChange(event.target.value)} placeholder="" aria-invalid={invalid} className={cn("h-11 text-left", value ? "pe-3" : "pe-14")} />{value ? null : <span className="pointer-events-none absolute end-3 top-1/2 -translate-y-1/2 text-xs text-muted-foreground">{tr("ر.ي")}</span>}</div>;
}

function EmployeeDetails({ employee, open, onOpenChange }: { employee: Employee | null; open: boolean; onOpenChange: (open: boolean) => void }) {
  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="w-[calc(100vw-1.5rem)] max-w-md rounded-xl font-sans">
        <DialogHeader className="text-start sm:text-start"><DialogTitle className="font-kufi text-base font-normal leading-7">{tr("ملف الموظف")}</DialogTitle><DialogDescription>{tr("بيانات الموظف الوظيفية والشخصية")}</DialogDescription></DialogHeader>
        {employee ? <div className="space-y-4"><div className="flex items-center gap-3 rounded-lg border bg-muted/25 p-3"><EmployeeAvatar name={employee.full_name} /><div><p className="font-medium">{employee.full_name}</p><p dir="ltr" className="text-left text-xs text-muted-foreground">{employee.employee_number}</p></div></div><dl className="grid grid-cols-2 gap-3 text-sm"><Detail label={tr("القسم")} value={employee.department} /><Detail label={tr("المسمى")} value={employee.position} /><Detail label={tr("نوع الدوام")} value={EMPLOYMENT_LABELS[employee.employment_type]} /><Detail label={tr("تاريخ التعيين")} value={formatArabicDate(employee.hire_date)} /><Detail label={tr("البريد العملي")} value={employee.work_email} /><Detail label={tr("الهاتف")} value={employee.phone} /></dl></div> : null}
      </DialogContent>
    </Dialog>
  );
}

function Detail({ label, value }: { label: string; value: string | null | undefined }) {
  return <div className="min-w-0 rounded-lg border border-border/70 p-3"><dt className="text-xs text-muted-foreground">{label}</dt><dd className="mt-1 truncate font-medium">{value || "—"}</dd></div>;
}

function formatArabicDate(value: string | null) {
  if (!value) return "—";
  return new Intl.DateTimeFormat(getLocale(), { year: "numeric", month: "short", day: "numeric" }).format(new Date(`${value}T12:00:00`));
}