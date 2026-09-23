-- =====================================================================
--  HR SYSTEM — COMPLETE SCHEMA (REFERENCE SNAPSHOT)
--  توليد: 2026-09-23  |  يعكس الحالة النهائية الصافية لقاعدة البيانات
-- ---------------------------------------------------------------------
--  ⚠️ هذا الملف مرجعي/توثيقي فقط.
--  الطريقة الرسمية لتكرار النظام على عميل جديد:
--      supabase link --project-ref <NEW_PROJECT_REF>
--      supabase db push
--  لا يحتوي هذا الملف — ولا أي ملف هجرة — على أي مفتاح API أو سر.
--  أسرار مثل GEMINI_API_KEY تبقى حصراً في Edge Function Secrets.
-- =====================================================================

-- =====================================================================
-- 1) الأنواع المخصصة (ENUMS)
-- =====================================================================
CREATE TYPE public.app_role AS ENUM ('admin', 'viewer', 'operator');

-- =====================================================================
-- 2) دوال البنية التحتية (تُنشأ قبل الجداول التي تستخدم تريجراتها)
-- =====================================================================
CREATE OR REPLACE FUNCTION public.update_updated_at_column()
RETURNS trigger LANGUAGE plpgsql SET search_path TO 'public'
AS $function$
BEGIN NEW.updated_at = now(); RETURN NEW; END;
$function$;

-- =====================================================================
-- 3) الفروع (BRANCHES)
-- =====================================================================
CREATE TABLE public.branches (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  name text NOT NULL,
  location text,
  status text NOT NULL DEFAULT 'active' CHECK (status IN ('active','inactive')),
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.branches TO authenticated;
GRANT ALL ON public.branches TO service_role;
ALTER TABLE public.branches ENABLE ROW LEVEL SECURITY;

CREATE TRIGGER trg_branches_updated_at
BEFORE UPDATE ON public.branches
FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

-- =====================================================================
-- 4) المستخدمون والأدوار
-- =====================================================================
CREATE TABLE public.users (
  id uuid PRIMARY KEY,
  email text NOT NULL,
  created_at timestamptz NOT NULL DEFAULT now(),
  branch_id uuid REFERENCES public.branches(id) ON DELETE SET NULL,
  avatar_path text
);
GRANT SELECT, INSERT, UPDATE ON public.users TO authenticated;
GRANT ALL ON public.users TO service_role;
ALTER TABLE public.users ENABLE ROW LEVEL SECURITY;

CREATE TABLE public.user_roles (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL,
  role public.app_role NOT NULL DEFAULT 'viewer',
  created_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (user_id, role)
);
GRANT SELECT, UPDATE ON public.user_roles TO authenticated;
GRANT ALL ON public.user_roles TO service_role;
ALTER TABLE public.user_roles ENABLE ROW LEVEL SECURITY;

-- =====================================================================
-- 5) الدوال الأمنية (SECURITY DEFINER) — بعد user_roles / users / branches
-- =====================================================================
CREATE OR REPLACE FUNCTION public.has_role(_user_id uuid, _role public.app_role)
RETURNS boolean LANGUAGE sql STABLE SECURITY DEFINER SET search_path TO 'public'
AS $function$
  SELECT EXISTS (SELECT 1 FROM public.user_roles WHERE user_id = _user_id AND role = _role);
$function$;

CREATE OR REPLACE FUNCTION public.has_role_name(_user_id uuid, _role text)
RETURNS boolean LANGUAGE sql STABLE SECURITY DEFINER SET search_path TO 'public'
AS $function$
  SELECT EXISTS (
    SELECT 1 FROM public.user_roles
    WHERE user_id = _user_id AND role::text = _role
  );
$function$;

CREATE OR REPLACE FUNCTION public.is_admin()
RETURNS boolean LANGUAGE sql STABLE SECURITY DEFINER SET search_path TO 'public'
AS $function$ SELECT public.has_role(auth.uid(), 'admin'::public.app_role); $function$;

CREATE OR REPLACE FUNCTION public.is_operator()
RETURNS boolean LANGUAGE sql STABLE SECURITY DEFINER SET search_path TO 'public'
AS $function$ SELECT public.has_role_name(auth.uid(), 'operator'); $function$;

CREATE OR REPLACE FUNCTION public.is_viewer()
RETURNS boolean LANGUAGE sql STABLE SECURITY DEFINER SET search_path TO 'public'
AS $function$ SELECT public.has_role_name(auth.uid(), 'viewer'); $function$;

CREATE OR REPLACE FUNCTION public.get_user_branch_id()
RETURNS uuid LANGUAGE sql STABLE SECURITY DEFINER SET search_path TO 'public'
AS $function$
  SELECT branch_id FROM public.users WHERE id = auth.uid();
$function$;

-- تزويد المستخدم الجديد تلقائياً بملف ودور افتراضي (viewer)
CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path TO 'public'
AS $function$
BEGIN
  INSERT INTO public.users (id, email) VALUES (NEW.id, NEW.email)
    ON CONFLICT (id) DO NOTHING;
  INSERT INTO public.user_roles (user_id, role) VALUES (NEW.id, 'viewer')
    ON CONFLICT (user_id, role) DO NOTHING;
  RETURN NEW;
END;
$function$;

CREATE TRIGGER on_auth_user_created
AFTER INSERT ON auth.users
FOR EACH ROW EXECUTE FUNCTION public.handle_new_user();

-- =====================================================================
-- 6) سياسات المستخدمين والأدوار والفروع
-- =====================================================================
CREATE POLICY "users read own or admin" ON public.users
  FOR SELECT TO authenticated USING (id = auth.uid() OR public.is_admin());
CREATE POLICY "users insert own" ON public.users
  FOR INSERT TO authenticated WITH CHECK (id = auth.uid());
CREATE POLICY "users update own" ON public.users
  FOR UPDATE TO authenticated USING (id = auth.uid()) WITH CHECK (id = auth.uid());

CREATE POLICY "roles read own" ON public.user_roles
  FOR SELECT TO authenticated USING (user_id = auth.uid());
CREATE POLICY "roles admin select all" ON public.user_roles
  FOR SELECT TO authenticated USING (public.is_admin());
CREATE POLICY "roles admin update" ON public.user_roles
  FOR UPDATE TO authenticated USING (public.is_admin()) WITH CHECK (public.is_admin());

CREATE POLICY "branches read authenticated" ON public.branches
  FOR SELECT TO authenticated USING (true);
CREATE POLICY "branches insert admin" ON public.branches
  FOR INSERT TO authenticated WITH CHECK (public.is_admin());
CREATE POLICY "branches update admin" ON public.branches
  FOR UPDATE TO authenticated USING (public.is_admin()) WITH CHECK (public.is_admin());
CREATE POLICY "branches delete admin" ON public.branches
  FOR DELETE TO authenticated USING (public.is_admin());

-- =====================================================================
-- 7) الموظفون (EMPLOYEES)
-- =====================================================================
CREATE TABLE public.employees (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  full_name text NOT NULL,
  position text,
  department text,
  hire_date date,
  phone text,
  status text NOT NULL DEFAULT 'active' CHECK (status IN ('active','inactive')),
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  branch_id uuid REFERENCES public.branches(id) ON DELETE SET NULL
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.employees TO authenticated;
GRANT ALL ON public.employees TO service_role;
ALTER TABLE public.employees ENABLE ROW LEVEL SECURITY;

CREATE INDEX idx_employees_branch ON public.employees (branch_id);

CREATE TRIGGER trg_employees_updated_at
BEFORE UPDATE ON public.employees
FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

CREATE OR REPLACE FUNCTION public.get_employee_branch_id(_employee_id uuid)
RETURNS uuid LANGUAGE sql STABLE SECURITY DEFINER SET search_path TO 'public'
AS $function$ SELECT branch_id FROM public.employees WHERE id = _employee_id; $function$;

CREATE POLICY "employees select by role and branch" ON public.employees
  FOR SELECT TO authenticated USING (
    public.is_admin()
    OR ((public.is_operator() OR public.is_viewer())
        AND branch_id IS NOT NULL
        AND branch_id = public.get_user_branch_id())
  );
CREATE POLICY "employees insert admin or operator branch" ON public.employees
  FOR INSERT TO authenticated WITH CHECK (
    public.is_admin()
    OR (public.is_operator() AND branch_id IS NOT NULL
        AND branch_id = public.get_user_branch_id())
  );
CREATE POLICY "employees update admin or operator branch" ON public.employees
  FOR UPDATE TO authenticated USING (
    public.is_admin()
    OR (public.is_operator() AND branch_id IS NOT NULL
        AND branch_id = public.get_user_branch_id())
  ) WITH CHECK (
    public.is_admin()
    OR (public.is_operator() AND branch_id IS NOT NULL
        AND branch_id = public.get_user_branch_id())
  );
CREATE POLICY "employees delete admin only" ON public.employees
  FOR DELETE TO authenticated USING (public.is_admin());

-- =====================================================================
-- 8) الحضور (ATTENDANCE)
-- =====================================================================
CREATE TABLE public.attendance (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  employee_id uuid NOT NULL REFERENCES public.employees(id) ON DELETE CASCADE,
  date date NOT NULL,
  status text NOT NULL CHECK (status IN ('present','late','absent')),
  note text,
  created_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (employee_id, date)
);
CREATE INDEX idx_attendance_employee_date ON public.attendance (employee_id, date);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.attendance TO authenticated;
GRANT ALL ON public.attendance TO service_role;
ALTER TABLE public.attendance ENABLE ROW LEVEL SECURITY;

CREATE POLICY "attendance select by role and branch" ON public.attendance
  FOR SELECT TO authenticated USING (
    public.is_admin()
    OR ((public.is_operator() OR public.is_viewer())
        AND public.get_employee_branch_id(employee_id) IS NOT NULL
        AND public.get_employee_branch_id(employee_id) = public.get_user_branch_id())
  );
CREATE POLICY "attendance insert admin or operator branch" ON public.attendance
  FOR INSERT TO authenticated WITH CHECK (
    public.is_admin()
    OR (public.is_operator()
        AND public.get_employee_branch_id(employee_id) IS NOT NULL
        AND public.get_employee_branch_id(employee_id) = public.get_user_branch_id())
  );
CREATE POLICY "attendance update admin or operator branch" ON public.attendance
  FOR UPDATE TO authenticated USING (
    public.is_admin()
    OR (public.is_operator()
        AND public.get_employee_branch_id(employee_id) IS NOT NULL
        AND public.get_employee_branch_id(employee_id) = public.get_user_branch_id())
  ) WITH CHECK (
    public.is_admin()
    OR (public.is_operator()
        AND public.get_employee_branch_id(employee_id) IS NOT NULL
        AND public.get_employee_branch_id(employee_id) = public.get_user_branch_id())
  );
CREATE POLICY "attendance delete admin only" ON public.attendance
  FOR DELETE TO authenticated USING (public.is_admin());

-- =====================================================================
-- 9) الإجازات (LEAVE REQUESTS)
-- =====================================================================
CREATE TABLE public.leave_requests (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  employee_id uuid NOT NULL REFERENCES public.employees(id) ON DELETE CASCADE,
  leave_type text NOT NULL DEFAULT 'annual',
  start_date date NOT NULL,
  end_date date NOT NULL,
  reason text,
  status text NOT NULL DEFAULT 'pending',
  requested_by uuid,
  approved_by uuid,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.leave_requests TO authenticated;
GRANT ALL ON public.leave_requests TO service_role;
ALTER TABLE public.leave_requests ENABLE ROW LEVEL SECURITY;

CREATE INDEX idx_leave_requests_employee_dates ON public.leave_requests (employee_id, start_date, end_date);
CREATE INDEX idx_leave_requests_status ON public.leave_requests (status);

CREATE POLICY "leaves select by role and branch" ON public.leave_requests
  FOR SELECT TO authenticated USING (
    public.is_admin()
    OR ((public.is_operator() OR public.is_viewer())
        AND public.get_employee_branch_id(employee_id) IS NOT NULL
        AND public.get_employee_branch_id(employee_id) = public.get_user_branch_id())
  );
CREATE POLICY "leaves insert admin or operator branch" ON public.leave_requests
  FOR INSERT TO authenticated WITH CHECK (
    public.is_admin()
    OR (public.is_operator() AND status = 'pending' AND approved_by IS NULL
        AND public.get_employee_branch_id(employee_id) IS NOT NULL
        AND public.get_employee_branch_id(employee_id) = public.get_user_branch_id())
  );
CREATE POLICY "leaves update admin or operator pending" ON public.leave_requests
  FOR UPDATE TO authenticated USING (
    public.is_admin()
    OR (public.is_operator() AND status = 'pending'
        AND public.get_employee_branch_id(employee_id) IS NOT NULL
        AND public.get_employee_branch_id(employee_id) = public.get_user_branch_id())
  ) WITH CHECK (
    public.is_admin()
    OR (public.is_operator() AND status = 'pending' AND approved_by IS NULL
        AND public.get_employee_branch_id(employee_id) IS NOT NULL
        AND public.get_employee_branch_id(employee_id) = public.get_user_branch_id())
  );
CREATE POLICY "leaves delete admin only" ON public.leave_requests
  FOR DELETE TO authenticated USING (public.is_admin());

CREATE TRIGGER trg_leave_requests_updated_at
BEFORE UPDATE ON public.leave_requests
FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

-- حارس سلامة طلبات الإجازة: لا أحد غير المدير يغيّر الحالة
CREATE OR REPLACE FUNCTION public.leave_requests_guard()
RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path TO 'public'
AS $function$
BEGIN
  IF TG_OP = 'INSERT' THEN
    NEW.requested_by := auth.uid();
    IF NOT public.is_admin() THEN
      NEW.status := 'pending';
      NEW.approved_by := NULL;
    END IF;
    IF NEW.status <> 'pending' THEN
      NEW.approved_by := auth.uid();
    END IF;
  ELSE
    NEW.requested_by := OLD.requested_by;
    IF NEW.status IS DISTINCT FROM OLD.status THEN
      IF NOT public.is_admin() THEN
        RAISE EXCEPTION 'forbidden: only admin can change leave status';
      END IF;
      IF NEW.status IN ('approved','rejected') THEN
        NEW.approved_by := auth.uid();
      ELSE
        NEW.approved_by := NULL;
      END IF;
    ELSE
      NEW.approved_by := OLD.approved_by;
    END IF;
  END IF;
  RETURN NEW;
END;
$function$;

CREATE TRIGGER trg_leave_requests_guard
BEFORE INSERT OR UPDATE ON public.leave_requests
FOR EACH ROW EXECUTE FUNCTION public.leave_requests_guard();

-- =====================================================================
-- 10) دوال الحساب (الإجازة المعتمدة لا تُحتسب غياباً)
-- =====================================================================
CREATE OR REPLACE FUNCTION public.has_approved_leave(_employee_id uuid, _date date)
RETURNS boolean LANGUAGE sql STABLE SECURITY DEFINER SET search_path TO 'public'
AS $function$
  SELECT EXISTS (
    SELECT 1 FROM public.leave_requests
    WHERE employee_id = _employee_id
      AND status = 'approved'
      AND _date BETWEEN start_date AND end_date
  );
$function$;

CREATE OR REPLACE FUNCTION public.unjustified_absent_days(_employee_id uuid, _month date)
RETURNS integer LANGUAGE sql STABLE SECURITY DEFINER SET search_path TO 'public'
AS $function$
  SELECT count(*)::int
  FROM public.attendance a
  WHERE a.employee_id = _employee_id
    AND a.status = 'absent'
    AND a.date >= date_trunc('month', _month)::date
    AND a.date < (date_trunc('month', _month) + interval '1 month')::date
    AND NOT public.has_approved_leave(a.employee_id, a.date);
$function$;

CREATE OR REPLACE FUNCTION public.monthly_attendance_rate(_employee_id uuid, _month date)
RETURNS numeric LANGUAGE plpgsql STABLE SET search_path TO 'public'
AS $function$
DECLARE
  _total int;
  _attended int;
BEGIN
  SELECT
    count(*) FILTER (WHERE NOT (a.status = 'absent' AND public.has_approved_leave(a.employee_id, a.date))),
    count(*) FILTER (WHERE a.status IN ('present','late'))
  INTO _total, _attended
  FROM public.attendance a
  WHERE a.employee_id = _employee_id
    AND a.date >= date_trunc('month', _month)::date
    AND a.date < (date_trunc('month', _month) + interval '1 month')::date;

  IF _total = 0 THEN RETURN 0; END IF;
  RETURN round((_attended::numeric / _total::numeric) * 100, 2);
END;
$function$;

CREATE OR REPLACE FUNCTION public.calculate_net_salary(
  _employee_id uuid, _month date, _base_salary numeric,
  _bonuses numeric DEFAULT 0, _deductions numeric DEFAULT 0)
RETURNS numeric LANGUAGE plpgsql STABLE SET search_path TO 'public'
AS $function$
DECLARE
  _absent_days int;
  _is_admin boolean;
BEGIN
  SELECT EXISTS (
    SELECT 1 FROM public.user_roles
    WHERE user_id = auth.uid() AND role = 'admin'
  ) INTO _is_admin;

  IF NOT _is_admin THEN
    RAISE EXCEPTION 'forbidden: payroll data is admin-only';
  END IF;

  IF _base_salary IS NULL THEN RETURN NULL; END IF;

  _absent_days := public.unjustified_absent_days(_employee_id, _month);

  RETURN round(_base_salary + COALESCE(_bonuses,0) - (_absent_days * (_base_salary / 30.0)) - COALESCE(_deductions,0), 2);
END;
$function$;

-- =====================================================================
-- 11) الرواتب (PAYROLL) — محصورة بالمدير في كل العمليات
-- =====================================================================
CREATE TABLE public.payroll (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  employee_id uuid NOT NULL REFERENCES public.employees(id) ON DELETE CASCADE,
  month date NOT NULL,
  base_salary numeric(12,2) NOT NULL DEFAULT 0,
  bonuses numeric(12,2) NOT NULL DEFAULT 0,
  deductions numeric(12,2) NOT NULL DEFAULT 0,
  net_salary numeric(12,2) NOT NULL DEFAULT 0,
  created_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (employee_id, month)
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.payroll TO authenticated;
GRANT ALL ON public.payroll TO service_role;
ALTER TABLE public.payroll ENABLE ROW LEVEL SECURITY;

CREATE POLICY "payroll read admin only" ON public.payroll
  FOR SELECT TO authenticated USING (public.is_admin());
CREATE POLICY "payroll insert admin" ON public.payroll
  FOR INSERT TO authenticated WITH CHECK (public.is_admin());
CREATE POLICY "payroll update admin" ON public.payroll
  FOR UPDATE TO authenticated USING (public.is_admin()) WITH CHECK (public.is_admin());
CREATE POLICY "payroll delete admin" ON public.payroll
  FOR DELETE TO authenticated USING (public.is_admin());

CREATE OR REPLACE FUNCTION public.payroll_set_net_salary()
RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path TO 'public'
AS $function$
DECLARE
  _absent_days int;
BEGIN
  _absent_days := public.unjustified_absent_days(NEW.employee_id, NEW.month);

  NEW.net_salary := round(
    COALESCE(NEW.base_salary,0) + COALESCE(NEW.bonuses,0)
    - (_absent_days * (COALESCE(NEW.base_salary,0) / 30.0))
    - COALESCE(NEW.deductions,0), 2);
  RETURN NEW;
END;
$function$;

CREATE TRIGGER trg_payroll_net_salary
BEFORE INSERT OR UPDATE ON public.payroll
FOR EACH ROW EXECUTE FUNCTION public.payroll_set_net_salary();

-- =====================================================================
-- 12) التقارير (REPORTS)
-- =====================================================================
CREATE TABLE public.reports (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  month date,
  content text,
  generated_at timestamptz NOT NULL DEFAULT now()
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.reports TO authenticated;
GRANT ALL ON public.reports TO service_role;
ALTER TABLE public.reports ENABLE ROW LEVEL SECURITY;

CREATE POLICY "reports read authenticated" ON public.reports
  FOR SELECT TO authenticated USING (true);
CREATE POLICY "reports insert admin" ON public.reports
  FOR INSERT TO authenticated WITH CHECK (public.is_admin());
CREATE POLICY "reports update admin" ON public.reports
  FOR UPDATE TO authenticated USING (public.is_admin()) WITH CHECK (public.is_admin());
CREATE POLICY "reports delete admin" ON public.reports
  FOR DELETE TO authenticated USING (public.is_admin());

-- =====================================================================
-- 13) إعدادات المؤسسة (APP SETTINGS)
-- =====================================================================
CREATE TABLE public.app_settings (
  id text PRIMARY KEY DEFAULT 'organization' CHECK (id = 'organization'),
  logo_path text,
  updated_at timestamptz NOT NULL DEFAULT now(),
  updated_by uuid REFERENCES auth.users(id) ON DELETE SET NULL,
  company_name text
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.app_settings TO authenticated;
GRANT ALL ON public.app_settings TO service_role;
ALTER TABLE public.app_settings ENABLE ROW LEVEL SECURITY;

CREATE POLICY "settings authenticated read" ON public.app_settings
  FOR SELECT TO authenticated USING (true);
CREATE POLICY "settings admin insert" ON public.app_settings
  FOR INSERT TO authenticated WITH CHECK (public.is_admin());
CREATE POLICY "settings admin update" ON public.app_settings
  FOR UPDATE TO authenticated USING (public.is_admin()) WITH CHECK (public.is_admin());
CREATE POLICY "settings admin delete" ON public.app_settings
  FOR DELETE TO authenticated USING (public.is_admin());

CREATE TRIGGER trg_app_settings_updated_at
BEFORE UPDATE ON public.app_settings
FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

INSERT INTO public.app_settings (id) VALUES ('organization') ON CONFLICT (id) DO NOTHING;

-- =====================================================================
-- 14) سياسات التخزين (حوض hr-branding)
--     ملاحظة: الحوض نفسه يُنشأ من واجهة/أداة التخزين، ثم تُطبَّق هذه السياسات.
-- =====================================================================
CREATE POLICY "branding authenticated read" ON storage.objects
  FOR SELECT TO authenticated USING (bucket_id = 'hr-branding');

CREATE POLICY "users upload own avatar" ON storage.objects
  FOR INSERT TO authenticated WITH CHECK (
    bucket_id = 'hr-branding'
    AND (storage.foldername(name))[1] = 'avatars'
    AND (storage.foldername(name))[2] = auth.uid()::text);
CREATE POLICY "users update own avatar" ON storage.objects
  FOR UPDATE TO authenticated USING (
    bucket_id = 'hr-branding'
    AND (storage.foldername(name))[1] = 'avatars'
    AND (storage.foldername(name))[2] = auth.uid()::text)
  WITH CHECK (
    bucket_id = 'hr-branding'
    AND (storage.foldername(name))[1] = 'avatars'
    AND (storage.foldername(name))[2] = auth.uid()::text);
CREATE POLICY "users delete own avatar" ON storage.objects
  FOR DELETE TO authenticated USING (
    bucket_id = 'hr-branding'
    AND (storage.foldername(name))[1] = 'avatars'
    AND (storage.foldername(name))[2] = auth.uid()::text);

CREATE POLICY "admin upload organization logo" ON storage.objects
  FOR INSERT TO authenticated WITH CHECK (
    bucket_id = 'hr-branding'
    AND (storage.foldername(name))[1] = 'organization'
    AND public.is_admin());
CREATE POLICY "admin update organization logo" ON storage.objects
  FOR UPDATE TO authenticated USING (
    bucket_id = 'hr-branding'
    AND (storage.foldername(name))[1] = 'organization'
    AND public.is_admin())
  WITH CHECK (
    bucket_id = 'hr-branding'
    AND (storage.foldername(name))[1] = 'organization'
    AND public.is_admin());
CREATE POLICY "admin delete organization logo" ON storage.objects
  FOR DELETE TO authenticated USING (
    bucket_id = 'hr-branding'
    AND (storage.foldername(name))[1] = 'organization'
    AND public.is_admin());

-- =====================================================================
-- 15) إغلاق صلاحيات تنفيذ الدوال (آخر خطوة)
-- =====================================================================
REVOKE ALL ON FUNCTION public.has_role(uuid, public.app_role) FROM PUBLIC, anon, authenticated;
REVOKE ALL ON FUNCTION public.has_role_name(uuid, text) FROM PUBLIC, anon, authenticated;
REVOKE ALL ON FUNCTION public.is_admin() FROM PUBLIC, anon, authenticated;
REVOKE ALL ON FUNCTION public.is_operator() FROM PUBLIC, anon, authenticated;
REVOKE ALL ON FUNCTION public.is_viewer() FROM PUBLIC, anon, authenticated;
REVOKE ALL ON FUNCTION public.get_user_branch_id() FROM PUBLIC, anon, authenticated;
REVOKE ALL ON FUNCTION public.get_employee_branch_id(uuid) FROM PUBLIC, anon, authenticated;
REVOKE ALL ON FUNCTION public.has_approved_leave(uuid, date) FROM PUBLIC, anon, authenticated;
REVOKE ALL ON FUNCTION public.unjustified_absent_days(uuid, date) FROM PUBLIC, anon, authenticated;
REVOKE ALL ON FUNCTION public.leave_requests_guard() FROM PUBLIC, anon, authenticated;
REVOKE ALL ON FUNCTION public.handle_new_user() FROM PUBLIC, anon, authenticated;
REVOKE ALL ON FUNCTION public.payroll_set_net_salary() FROM PUBLIC, anon, authenticated;
REVOKE ALL ON FUNCTION public.update_updated_at_column() FROM PUBLIC, anon, authenticated;
REVOKE ALL ON FUNCTION public.calculate_net_salary(uuid, date, numeric, numeric, numeric) FROM PUBLIC, anon;
REVOKE ALL ON FUNCTION public.monthly_attendance_rate(uuid, date) FROM PUBLIC, anon;

GRANT EXECUTE ON FUNCTION public.calculate_net_salary(uuid, date, numeric, numeric, numeric) TO authenticated;
GRANT EXECUTE ON FUNCTION public.monthly_attendance_rate(uuid, date) TO authenticated;

-- =====================================================================
-- 16) حقول إدارة الموظفين الموسّعة
-- =====================================================================
CREATE SEQUENCE IF NOT EXISTS public.employee_number_seq START WITH 1001;
GRANT USAGE, SELECT ON SEQUENCE public.employee_number_seq TO authenticated;
GRANT ALL ON SEQUENCE public.employee_number_seq TO service_role;

ALTER TABLE public.employees
  ADD COLUMN employee_number text,
  ADD COLUMN work_email text,
  ADD COLUMN full_name_en text,
  ADD COLUMN manager_id uuid REFERENCES public.employees(id) ON DELETE SET NULL,
  ADD COLUMN employment_type text NOT NULL DEFAULT 'full_time',
  ADD COLUMN national_id text,
  ADD COLUMN birth_date date,
  ADD COLUMN nationality text,
  ADD COLUMN gender text;

UPDATE public.employees
SET employee_number = 'EMP-' || lpad(nextval('public.employee_number_seq')::text, 4, '0')
WHERE employee_number IS NULL;

ALTER TABLE public.employees
  ALTER COLUMN employee_number SET DEFAULT ('EMP-' || lpad(nextval('public.employee_number_seq')::text, 4, '0')),
  ALTER COLUMN employee_number SET NOT NULL,
  ADD CONSTRAINT employees_employee_number_key UNIQUE (employee_number),
  ADD CONSTRAINT employees_employment_type_check CHECK (employment_type IN ('full_time', 'part_time', 'remote')),
  ADD CONSTRAINT employees_gender_check CHECK (gender IS NULL OR gender IN ('male', 'female'));

CREATE UNIQUE INDEX employees_work_email_unique_idx ON public.employees (lower(work_email)) WHERE work_email IS NOT NULL;
CREATE UNIQUE INDEX employees_national_id_unique_idx ON public.employees (national_id) WHERE national_id IS NOT NULL;
CREATE INDEX employees_manager_id_idx ON public.employees (manager_id);
CREATE INDEX employees_department_idx ON public.employees (department);

ALTER TABLE public.payroll
  ADD COLUMN housing_allowance numeric NOT NULL DEFAULT 0 CHECK (housing_allowance >= 0),
  ADD COLUMN transport_allowance numeric NOT NULL DEFAULT 0 CHECK (transport_allowance >= 0),
  ADD COLUMN iban text;

CREATE UNIQUE INDEX payroll_employee_month_unique_idx ON public.payroll (employee_id, month);
CREATE INDEX payroll_iban_idx ON public.payroll (iban) WHERE iban IS NOT NULL;

CREATE OR REPLACE FUNCTION public.payroll_set_net_salary()
RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path TO 'public'
AS $function$
DECLARE _absent_days int;
BEGIN
  _absent_days := public.unjustified_absent_days(NEW.employee_id, NEW.month);
  NEW.net_salary := round(
    COALESCE(NEW.base_salary,0)
    + COALESCE(NEW.housing_allowance,0)
    + COALESCE(NEW.transport_allowance,0)
    + COALESCE(NEW.bonuses,0)
    - (_absent_days * (COALESCE(NEW.base_salary,0) / 30.0))
    - COALESCE(NEW.deductions,0), 2);
  RETURN NEW;
END;
$function$;

REVOKE ALL ON FUNCTION public.payroll_set_net_salary() FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.payroll_set_net_salary() TO service_role;

-- ترقية البيانات البنكية والتحقق المالي
ALTER TABLE public.payroll
  ADD COLUMN bank_name text,
  ADD CONSTRAINT payroll_base_salary_nonnegative_check CHECK (base_salary >= 0),
  ADD CONSTRAINT payroll_bonuses_nonnegative_check CHECK (bonuses >= 0),
  ADD CONSTRAINT payroll_deductions_nonnegative_check CHECK (deductions >= 0);

-- =====================================================================
--  نهاية المرجع
-- =====================================================================
