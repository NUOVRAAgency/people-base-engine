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
  ADD COLUMN transport_allowance numeric NOT NULL DEFAULT 0 CHECK (transport_allowance >= 0);

CREATE UNIQUE INDEX payroll_employee_month_unique_idx ON public.payroll (employee_id, month);

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
  ADD CONSTRAINT payroll_deductions_nonnegative_check CHECK (deductions >= 0),
  ADD CONSTRAINT payroll_bank_name_length_check CHECK (bank_name IS NULL OR char_length(btrim(bank_name)) BETWEEN 2 AND 100);

-- =====================================================================
--  نهاية المرجع
-- =====================================================================

-- =====================================================================
-- ACCOUNTING PHASE 1 (mirrors supabase/migrations/20261014013000_accounting_phase1_complete.sql)
-- The migrations folder is the authoritative install path; this section is a reference copy.
-- =====================================================================
-- Accounting Phase 1 (complete, idempotent). Safe on an empty project and on re-run.
CREATE SCHEMA IF NOT EXISTS private;

CREATE TABLE IF NOT EXISTS public.chart_of_accounts (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  code text NOT NULL UNIQUE,
  name_ar text NOT NULL,
  name_en text,
  account_type text NOT NULL CHECK (account_type IN ('asset','liability','equity','revenue','expense')),
  normal_side text NOT NULL CHECK (normal_side IN ('debit','credit')),
  parent_id uuid REFERENCES public.chart_of_accounts(id) ON DELETE RESTRICT,
  is_parent boolean NOT NULL DEFAULT false,
  is_active boolean NOT NULL DEFAULT true,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.chart_of_accounts TO authenticated;
GRANT ALL ON public.chart_of_accounts TO service_role;
ALTER TABLE public.chart_of_accounts ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "coa admin all" ON public.chart_of_accounts;
CREATE POLICY "coa admin all" ON public.chart_of_accounts FOR ALL TO authenticated USING (private.is_admin()) WITH CHECK (private.is_admin());

CREATE TABLE IF NOT EXISTS public.cash_and_banks (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  name text NOT NULL,
  kind text NOT NULL CHECK (kind IN ('cash','bank')),
  account_id uuid NOT NULL REFERENCES public.chart_of_accounts(id) ON DELETE RESTRICT,
  branch_id uuid REFERENCES public.branches(id) ON DELETE RESTRICT,
  bank_account_number text,
  is_active boolean NOT NULL DEFAULT true,
  created_at timestamptz NOT NULL DEFAULT now()
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.cash_and_banks TO authenticated;
GRANT ALL ON public.cash_and_banks TO service_role;
ALTER TABLE public.cash_and_banks ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "cash admin all" ON public.cash_and_banks;
CREATE POLICY "cash admin all" ON public.cash_and_banks FOR ALL TO authenticated USING (private.is_admin()) WITH CHECK (private.is_admin());

CREATE TABLE IF NOT EXISTS public.cost_centers (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  code text NOT NULL UNIQUE,
  name text NOT NULL,
  branch_id uuid REFERENCES public.branches(id) ON DELETE RESTRICT,
  is_active boolean NOT NULL DEFAULT true,
  created_at timestamptz NOT NULL DEFAULT now()
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.cost_centers TO authenticated;
GRANT ALL ON public.cost_centers TO service_role;
ALTER TABLE public.cost_centers ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "cc admin all" ON public.cost_centers;
CREATE POLICY "cc admin all" ON public.cost_centers FOR ALL TO authenticated USING (private.is_admin()) WITH CHECK (private.is_admin());

CREATE SEQUENCE IF NOT EXISTS public.journal_entry_number_seq;
GRANT USAGE ON SEQUENCE public.journal_entry_number_seq TO authenticated, service_role;
CREATE TABLE IF NOT EXISTS public.journal_entries (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  entry_number text NOT NULL UNIQUE DEFAULT ('JE-' || lpad(nextval('public.journal_entry_number_seq')::text, 6, '0')),
  entry_date date NOT NULL DEFAULT current_date,
  branch_id uuid REFERENCES public.branches(id) ON DELETE RESTRICT,
  description text,
  source text NOT NULL DEFAULT 'manual' CHECK (source IN ('manual','payroll','payment_voucher','reversal')),
  status text NOT NULL DEFAULT 'draft' CHECK (status IN ('draft','posted')),
  reverses_entry_id uuid UNIQUE REFERENCES public.journal_entries(id) ON DELETE RESTRICT,
  posted_at timestamptz,
  posted_by uuid,
  created_by uuid DEFAULT auth.uid(),
  created_at timestamptz NOT NULL DEFAULT now()
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.journal_entries TO authenticated;
GRANT ALL ON public.journal_entries TO service_role;
ALTER TABLE public.journal_entries ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "je admin all" ON public.journal_entries;
CREATE POLICY "je admin all" ON public.journal_entries FOR ALL TO authenticated USING (private.is_admin()) WITH CHECK (private.is_admin());

CREATE TABLE IF NOT EXISTS public.journal_entry_lines (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  journal_entry_id uuid NOT NULL REFERENCES public.journal_entries(id) ON DELETE RESTRICT,
  account_id uuid NOT NULL REFERENCES public.chart_of_accounts(id) ON DELETE RESTRICT,
  cost_center_id uuid REFERENCES public.cost_centers(id) ON DELETE RESTRICT,
  debit numeric(14,2) NOT NULL DEFAULT 0 CHECK (debit >= 0),
  credit numeric(14,2) NOT NULL DEFAULT 0 CHECK (credit >= 0),
  memo text,
  rule_key text,
  created_at timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT jel_one_side CHECK ((debit > 0 AND credit = 0) OR (credit > 0 AND debit = 0))
);
CREATE INDEX IF NOT EXISTS journal_entry_lines_entry_idx ON public.journal_entry_lines (journal_entry_id);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.journal_entry_lines TO authenticated;
GRANT ALL ON public.journal_entry_lines TO service_role;
ALTER TABLE public.journal_entry_lines ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "jel admin all" ON public.journal_entry_lines;
CREATE POLICY "jel admin all" ON public.journal_entry_lines FOR ALL TO authenticated USING (private.is_admin()) WITH CHECK (private.is_admin());

CREATE SEQUENCE IF NOT EXISTS public.payment_voucher_number_seq;
GRANT USAGE ON SEQUENCE public.payment_voucher_number_seq TO authenticated, service_role;
CREATE TABLE IF NOT EXISTS public.payment_vouchers (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  voucher_number text NOT NULL UNIQUE DEFAULT ('PV-' || lpad(nextval('public.payment_voucher_number_seq')::text, 6, '0')),
  voucher_date date NOT NULL DEFAULT current_date,
  branch_id uuid REFERENCES public.branches(id) ON DELETE RESTRICT,
  cash_bank_id uuid NOT NULL REFERENCES public.cash_and_banks(id) ON DELETE RESTRICT,
  amount numeric(14,2) NOT NULL CHECK (amount > 0),
  payroll_month date,
  source_journal_entry_id uuid REFERENCES public.journal_entries(id) ON DELETE RESTRICT,
  journal_entry_id uuid UNIQUE REFERENCES public.journal_entries(id) ON DELETE RESTRICT,
  description text,
  created_by uuid DEFAULT auth.uid(),
  created_at timestamptz NOT NULL DEFAULT now()
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.payment_vouchers TO authenticated;
GRANT ALL ON public.payment_vouchers TO service_role;
ALTER TABLE public.payment_vouchers ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "pv admin all" ON public.payment_vouchers;
CREATE POLICY "pv admin all" ON public.payment_vouchers FOR ALL TO authenticated USING (private.is_admin()) WITH CHECK (private.is_admin());

CREATE TABLE IF NOT EXISTS public.payroll_journal_links (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  payroll_month date NOT NULL,
  branch_id uuid NOT NULL REFERENCES public.branches(id) ON DELETE RESTRICT,
  journal_entry_id uuid NOT NULL UNIQUE REFERENCES public.journal_entries(id) ON DELETE RESTRICT,
  is_reversed boolean NOT NULL DEFAULT false,
  reversed_at timestamptz,
  created_by uuid DEFAULT auth.uid(),
  created_at timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT pjl_month_first_day CHECK (payroll_month = date_trunc('month', payroll_month)::date)
);
CREATE UNIQUE INDEX IF NOT EXISTS uq_active_payroll_branch_month ON public.payroll_journal_links (payroll_month, branch_id) WHERE (is_reversed = false);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.payroll_journal_links TO authenticated;
GRANT ALL ON public.payroll_journal_links TO service_role;
ALTER TABLE public.payroll_journal_links ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "pjl admin all" ON public.payroll_journal_links;
CREATE POLICY "pjl admin all" ON public.payroll_journal_links FOR ALL TO authenticated USING (private.is_admin()) WITH CHECK (private.is_admin());

CREATE TABLE IF NOT EXISTS public.payroll_accounting_rules (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  rule_key text NOT NULL UNIQUE,
  entry_side text NOT NULL CHECK (entry_side IN ('debit','credit')),
  account_id uuid NOT NULL REFERENCES public.chart_of_accounts(id) ON DELETE RESTRICT,
  description text,
  is_active boolean NOT NULL DEFAULT true,
  updated_at timestamptz NOT NULL DEFAULT now()
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.payroll_accounting_rules TO authenticated;
GRANT ALL ON public.payroll_accounting_rules TO service_role;
ALTER TABLE public.payroll_accounting_rules ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "par admin all" ON public.payroll_accounting_rules;
CREATE POLICY "par admin all" ON public.payroll_accounting_rules FOR ALL TO authenticated USING (private.is_admin()) WITH CHECK (private.is_admin());

CREATE OR REPLACE FUNCTION private.jel_guard()
RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path TO 'public' AS $$
DECLARE _status text; _is_parent boolean;
BEGIN
  IF TG_OP IN ('UPDATE','DELETE') THEN
    SELECT status INTO _status FROM public.journal_entries WHERE id = OLD.journal_entry_id;
    IF _status = 'posted' THEN RAISE EXCEPTION 'posted_entry_immutable: use a reversing entry'; END IF;
  END IF;
  IF TG_OP IN ('INSERT','UPDATE') THEN
    SELECT status INTO _status FROM public.journal_entries WHERE id = NEW.journal_entry_id;
    IF _status = 'posted' THEN RAISE EXCEPTION 'posted_entry_immutable: use a reversing entry'; END IF;
    SELECT is_parent INTO _is_parent FROM public.chart_of_accounts WHERE id = NEW.account_id;
    IF _is_parent THEN RAISE EXCEPTION 'parent_account_not_postable'; END IF;
  END IF;
  IF TG_OP = 'DELETE' THEN RETURN OLD; END IF;
  RETURN NEW;
END $$;
DROP TRIGGER IF EXISTS trg_jel_guard ON public.journal_entry_lines;
CREATE TRIGGER trg_jel_guard BEFORE INSERT OR UPDATE OR DELETE ON public.journal_entry_lines
FOR EACH ROW EXECUTE FUNCTION private.jel_guard();

CREATE OR REPLACE FUNCTION private.je_guard()
RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path TO 'public' AS $$
DECLARE _d numeric; _c numeric; _n int;
BEGIN
  IF TG_OP = 'DELETE' THEN
    IF OLD.status = 'posted' THEN RAISE EXCEPTION 'posted_entry_immutable: use a reversing entry'; END IF;
    RETURN OLD;
  END IF;
  IF TG_OP = 'UPDATE' AND OLD.status = 'posted' THEN
    RAISE EXCEPTION 'posted_entry_immutable: use a reversing entry';
  END IF;
  IF NEW.status = 'posted' THEN
    SELECT COALESCE(sum(debit),0), COALESCE(sum(credit),0), count(*) INTO _d, _c, _n
    FROM public.journal_entry_lines WHERE journal_entry_id = NEW.id;
    IF _n < 2 OR _d = 0 OR _d <> _c THEN
      RAISE EXCEPTION 'unbalanced_entry: debit % credit % lines %', _d, _c, _n;
    END IF;
    IF EXISTS (SELECT 1 FROM public.journal_entry_lines l JOIN public.chart_of_accounts a ON a.id = l.account_id
               WHERE l.journal_entry_id = NEW.id AND a.is_parent) THEN
      RAISE EXCEPTION 'parent_account_not_postable';
    END IF;
    NEW.posted_at := now();
    NEW.posted_by := auth.uid();
  END IF;
  RETURN NEW;
END $$;
DROP TRIGGER IF EXISTS trg_je_guard ON public.journal_entries;
CREATE TRIGGER trg_je_guard BEFORE INSERT OR UPDATE OR DELETE ON public.journal_entries
FOR EACH ROW EXECUTE FUNCTION private.je_guard();

CREATE OR REPLACE FUNCTION private.coa_guard()
RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path TO 'public' AS $$
BEGIN
  IF NEW.is_parent AND EXISTS (SELECT 1 FROM public.journal_entry_lines WHERE account_id = NEW.id) THEN
    RAISE EXCEPTION 'account_has_lines_cannot_be_parent';
  END IF;
  NEW.updated_at := now();
  RETURN NEW;
END $$;
DROP TRIGGER IF EXISTS trg_coa_guard ON public.chart_of_accounts;
CREATE TRIGGER trg_coa_guard BEFORE UPDATE ON public.chart_of_accounts
FOR EACH ROW EXECUTE FUNCTION private.coa_guard();

CREATE OR REPLACE FUNCTION private.pjl_guard()
RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path TO 'public' AS $$
BEGIN
  IF TG_OP = 'DELETE' THEN RAISE EXCEPTION 'payroll_link_not_deletable'; END IF;
  IF NEW.payroll_month IS DISTINCT FROM OLD.payroll_month OR NEW.branch_id IS DISTINCT FROM OLD.branch_id
     OR NEW.journal_entry_id IS DISTINCT FROM OLD.journal_entry_id OR (OLD.is_reversed AND NOT NEW.is_reversed) THEN
    RAISE EXCEPTION 'payroll_link_immutable';
  END IF;
  IF NEW.is_reversed AND NOT OLD.is_reversed THEN
    IF NOT EXISTS (SELECT 1 FROM public.journal_entries WHERE reverses_entry_id = OLD.journal_entry_id AND status = 'posted') THEN
      RAISE EXCEPTION 'reversal_entry_required';
    END IF;
    NEW.reversed_at := now();
  END IF;
  RETURN NEW;
END $$;
DROP TRIGGER IF EXISTS trg_pjl_guard ON public.payroll_journal_links;
CREATE TRIGGER trg_pjl_guard BEFORE UPDATE OR DELETE ON public.payroll_journal_links
FOR EACH ROW EXECUTE FUNCTION private.pjl_guard();

CREATE OR REPLACE FUNCTION private.is_period_locked(_month date, _employee_id uuid)
RETURNS boolean LANGUAGE sql STABLE SECURITY DEFINER SET search_path TO 'public' AS $$
  SELECT EXISTS (
    SELECT 1 FROM public.payroll_journal_links l
    JOIN public.employees e ON e.id = _employee_id
    WHERE l.payroll_month = date_trunc('month', _month)::date
      AND l.branch_id = e.branch_id
      AND l.is_reversed = false
  );
$$;

CREATE OR REPLACE FUNCTION private.check_payroll_period_lock()
RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path TO 'public' AS $$
BEGIN
  IF TG_TABLE_NAME = 'payroll' THEN
    IF TG_OP = 'UPDATE' AND (to_jsonb(NEW) - 'status') = (to_jsonb(OLD) - 'status') THEN
      RETURN NEW;
    END IF;
    IF TG_OP IN ('UPDATE','DELETE') AND private.is_period_locked(OLD.month, OLD.employee_id) THEN
      RAISE EXCEPTION 'period_locked: payroll %', OLD.month;
    END IF;
    IF TG_OP IN ('INSERT','UPDATE') AND private.is_period_locked(NEW.month, NEW.employee_id) THEN
      RAISE EXCEPTION 'period_locked: payroll %', NEW.month;
    END IF;
  ELSIF TG_TABLE_NAME = 'payroll_adjustments' THEN
    IF TG_OP IN ('UPDATE','DELETE') AND private.is_period_locked(OLD.month, OLD.employee_id) THEN
      RAISE EXCEPTION 'period_locked: adjustments %', OLD.month;
    END IF;
    IF TG_OP IN ('INSERT','UPDATE') AND private.is_period_locked(NEW.month, NEW.employee_id) THEN
      RAISE EXCEPTION 'period_locked: adjustments %', NEW.month;
    END IF;
  ELSIF TG_TABLE_NAME = 'attendance' THEN
    IF TG_OP IN ('UPDATE','DELETE') AND private.is_period_locked(OLD.date, OLD.employee_id) THEN
      RAISE EXCEPTION 'period_locked: attendance %', OLD.date;
    END IF;
    IF TG_OP IN ('INSERT','UPDATE') AND private.is_period_locked(NEW.date, NEW.employee_id) THEN
      RAISE EXCEPTION 'period_locked: attendance %', NEW.date;
    END IF;
  ELSIF TG_TABLE_NAME = 'employee_loans' THEN
    IF TG_OP = 'UPDATE'
       AND (to_jsonb(NEW) - 'paid_amount' - 'status' - 'updated_at') = (to_jsonb(OLD) - 'paid_amount' - 'status' - 'updated_at') THEN
      RETURN NEW;
    END IF;
    IF TG_OP IN ('UPDATE','DELETE') AND EXISTS (
      SELECT 1 FROM public.payroll_journal_links l JOIN public.employees e ON e.id = OLD.employee_id
      WHERE l.branch_id = e.branch_id AND l.is_reversed = false AND l.payroll_month >= date_trunc('month', OLD.start_month)::date) THEN
      RAISE EXCEPTION 'period_locked: loan terms';
    END IF;
    IF TG_OP IN ('INSERT','UPDATE') AND private.is_period_locked(NEW.start_month, NEW.employee_id) THEN
      RAISE EXCEPTION 'period_locked: loan start month %', NEW.start_month;
    END IF;
  END IF;
  IF TG_OP = 'DELETE' THEN RETURN OLD; END IF;
  RETURN NEW;
END $$;

DROP TRIGGER IF EXISTS trg_aa_lock_payroll ON public.payroll;
CREATE TRIGGER trg_aa_lock_payroll BEFORE INSERT OR UPDATE OR DELETE ON public.payroll
FOR EACH ROW EXECUTE FUNCTION private.check_payroll_period_lock();
DROP TRIGGER IF EXISTS trg_aa_lock_adjustments ON public.payroll_adjustments;
CREATE TRIGGER trg_aa_lock_adjustments BEFORE INSERT OR UPDATE OR DELETE ON public.payroll_adjustments
FOR EACH ROW EXECUTE FUNCTION private.check_payroll_period_lock();
DROP TRIGGER IF EXISTS trg_aa_lock_attendance ON public.attendance;
CREATE TRIGGER trg_aa_lock_attendance BEFORE INSERT OR UPDATE OR DELETE ON public.attendance
FOR EACH ROW EXECUTE FUNCTION private.check_payroll_period_lock();
DROP TRIGGER IF EXISTS trg_aa_lock_loans ON public.employee_loans;
CREATE TRIGGER trg_aa_lock_loans BEFORE INSERT OR UPDATE OR DELETE ON public.employee_loans
FOR EACH ROW EXECUTE FUNCTION private.check_payroll_period_lock();


INSERT INTO public.chart_of_accounts (code, name_ar, name_en, account_type, normal_side, is_parent) VALUES
 ('1','الأصول','Assets','asset','debit',true),
 ('2','الالتزامات','Liabilities','liability','credit',true),
 ('3','حقوق الملكية','Equity','equity','credit',true),
 ('4','الإيرادات','Revenue','revenue','credit',true),
 ('5','المصروفات','Expenses','expense','debit',true)
ON CONFLICT (code) DO NOTHING;

INSERT INTO public.chart_of_accounts (code, name_ar, name_en, account_type, normal_side, is_parent, parent_id)
SELECT v.code, v.name_ar, v.name_en, v.t, v.s, v.p, (SELECT id FROM public.chart_of_accounts WHERE code = v.parent)
FROM (VALUES
 ('11','الأصول المتداولة','Current assets','asset','debit',true,'1'),
 ('21','الالتزامات المتداولة','Current liabilities','liability','credit',true,'2'),
 ('31','رأس المال','Capital','equity','credit',false,'3'),
 ('32','الأرباح المحتجزة','Retained earnings','equity','credit',false,'3'),
 ('41','إيرادات أخرى','Other revenue','revenue','credit',true,'4'),
 ('51','مصروفات الرواتب والأجور','Payroll expenses','expense','debit',true,'5')
) AS v(code,name_ar,name_en,t,s,p,parent)
ON CONFLICT (code) DO NOTHING;

INSERT INTO public.chart_of_accounts (code, name_ar, name_en, account_type, normal_side, is_parent, parent_id)
SELECT v.code, v.name_ar, v.name_en, v.t, v.s, false, (SELECT id FROM public.chart_of_accounts WHERE code = v.parent)
FROM (VALUES
 ('1101','الصندوق','Cash on hand','asset','debit','11'),
 ('1102','البنك','Bank','asset','debit','11'),
 ('1103','سلف الموظفين','Employee advances','asset','debit','11'),
 ('2101','الرواتب المستحقة','Accrued salaries','liability','credit','21'),
 ('4101','إيرادات جزاءات الموظفين','Employee penalties income','revenue','credit','41'),
 ('5101','الرواتب الأساسية','Basic salaries','expense','debit','51'),
 ('5102','بدل السكن','Housing allowance','expense','debit','51'),
 ('5103','بدل النقل','Transport allowance','expense','debit','51'),
 ('5104','العمل الإضافي','Overtime','expense','debit','51'),
 ('5105','المكافآت','Bonuses','expense','debit','51'),
 ('5106','إضافات أخرى على الرواتب','Other payroll additions','expense','debit','51'),
 ('5109','خصومات الغياب (مقابل مصروف الرواتب)','Absence deductions (contra payroll expense)','expense','credit','51')
) AS v(code,name_ar,name_en,t,s,parent)
ON CONFLICT (code) DO NOTHING;

INSERT INTO public.payroll_accounting_rules (rule_key, entry_side, account_id, description)
SELECT v.k, v.s, (SELECT id FROM public.chart_of_accounts WHERE code = v.code), v.d
FROM (VALUES
 ('base_salary','debit','5101','الراتب الأساسي'),
 ('housing_allowance','debit','5102','بدل السكن'),
 ('transport_allowance','debit','5103','بدل النقل'),
 ('overtime','debit','5104','العمل الإضافي'),
 ('bonuses','debit','5105','المكافآت'),
 ('other_additions','debit','5106','تسويات الإضافة'),
 ('absence_deduction','credit','5109','خصم الغياب يخفض مصروف الرواتب'),
 ('loan_deduction','credit','1103','قسط السلفة يخفض سلف الموظفين'),
 ('penalty_deduction','credit','4101','الجزاءات والخصومات الأخرى'),
 ('net_payable','credit','2101','صافي الرواتب المستحقة')
) AS v(k,s,code,d)
ON CONFLICT (rule_key) DO NOTHING;
-- ---------- Phase 1 closing ----------
-- Employees must belong to a branch (needed for per-branch payroll locking).
ALTER TABLE public.employees ALTER COLUMN branch_id SET NOT NULL;

-- Block moving an employee to another branch while they have payroll/attendance in a locked month.
CREATE OR REPLACE FUNCTION private.employee_branch_lock_guard()
RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path TO 'public' AS $$
BEGIN
  IF NEW.branch_id IS DISTINCT FROM OLD.branch_id AND (
       EXISTS (SELECT 1 FROM public.payroll p WHERE p.employee_id = OLD.id AND private.is_period_locked(p.month, OLD.id))
    OR EXISTS (SELECT 1 FROM public.attendance a WHERE a.employee_id = OLD.id AND private.is_period_locked(a.date, OLD.id))
  ) THEN
    RAISE EXCEPTION 'period_locked: employee branch';
  END IF;
  RETURN NEW;
END $$;
DROP TRIGGER IF EXISTS trg_aa_employee_branch_lock ON public.employees;
CREATE TRIGGER trg_aa_employee_branch_lock BEFORE UPDATE OF branch_id ON public.employees
FOR EACH ROW EXECUTE FUNCTION private.employee_branch_lock_guard();

-- Trigger-only functions: nobody calls them directly.
REVOKE EXECUTE ON FUNCTION private.check_payroll_period_lock(), private.coa_guard(),
  private.je_guard(), private.jel_guard(), private.pjl_guard(), private.employee_branch_lock_guard()
  FROM PUBLIC, anon, authenticated;
-- is_period_locked: platform guard refuses revoking from authenticated; no policy uses it. Revoke from anon/PUBLIC only.
REVOKE EXECUTE ON FUNCTION private.is_period_locked(date, uuid) FROM PUBLIC, anon, authenticated;
