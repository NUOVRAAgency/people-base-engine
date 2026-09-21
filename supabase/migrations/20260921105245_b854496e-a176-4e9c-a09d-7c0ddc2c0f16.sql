
-- ROLES
CREATE TYPE public.app_role AS ENUM ('admin', 'viewer');

CREATE TABLE public.users (
  id uuid PRIMARY KEY,
  email text NOT NULL,
  created_at timestamptz NOT NULL DEFAULT now()
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
GRANT SELECT ON public.user_roles TO authenticated;
GRANT ALL ON public.user_roles TO service_role;
ALTER TABLE public.user_roles ENABLE ROW LEVEL SECURITY;

CREATE OR REPLACE FUNCTION public.has_role(_user_id uuid, _role public.app_role)
RETURNS boolean LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public AS $$
  SELECT EXISTS (SELECT 1 FROM public.user_roles WHERE user_id = _user_id AND role = _role);
$$;

CREATE OR REPLACE FUNCTION public.is_admin()
RETURNS boolean LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public AS $$
  SELECT public.has_role(auth.uid(), 'admin'::public.app_role);
$$;

CREATE POLICY "users read own or admin" ON public.users FOR SELECT TO authenticated
  USING (id = auth.uid() OR public.is_admin());
CREATE POLICY "users insert own" ON public.users FOR INSERT TO authenticated
  WITH CHECK (id = auth.uid());
CREATE POLICY "users update own" ON public.users FOR UPDATE TO authenticated
  USING (id = auth.uid()) WITH CHECK (id = auth.uid());

CREATE POLICY "roles read own or admin" ON public.user_roles FOR SELECT TO authenticated
  USING (user_id = auth.uid() OR public.is_admin());

-- auto-provision profile + default viewer role on signup
CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
BEGIN
  INSERT INTO public.users (id, email) VALUES (NEW.id, NEW.email)
    ON CONFLICT (id) DO NOTHING;
  INSERT INTO public.user_roles (user_id, role) VALUES (NEW.id, 'viewer')
    ON CONFLICT (user_id, role) DO NOTHING;
  RETURN NEW;
END;
$$;

CREATE TRIGGER on_auth_user_created
AFTER INSERT ON auth.users
FOR EACH ROW EXECUTE FUNCTION public.handle_new_user();

-- EMPLOYEES
CREATE TABLE public.employees (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  full_name text NOT NULL,
  position text,
  department text,
  hire_date date,
  base_salary numeric(12,2) NOT NULL DEFAULT 0,
  phone text,
  status text NOT NULL DEFAULT 'active' CHECK (status IN ('active','inactive')),
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.employees TO authenticated;
GRANT ALL ON public.employees TO service_role;
ALTER TABLE public.employees ENABLE ROW LEVEL SECURITY;
CREATE POLICY "employees read authenticated" ON public.employees FOR SELECT TO authenticated USING (true);
CREATE POLICY "employees insert admin" ON public.employees FOR INSERT TO authenticated WITH CHECK (public.is_admin());
CREATE POLICY "employees update admin" ON public.employees FOR UPDATE TO authenticated USING (public.is_admin()) WITH CHECK (public.is_admin());
CREATE POLICY "employees delete admin" ON public.employees FOR DELETE TO authenticated USING (public.is_admin());

-- ATTENDANCE
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
CREATE POLICY "attendance read authenticated" ON public.attendance FOR SELECT TO authenticated USING (true);
CREATE POLICY "attendance insert admin" ON public.attendance FOR INSERT TO authenticated WITH CHECK (public.is_admin());
CREATE POLICY "attendance update admin" ON public.attendance FOR UPDATE TO authenticated USING (public.is_admin()) WITH CHECK (public.is_admin());
CREATE POLICY "attendance delete admin" ON public.attendance FOR DELETE TO authenticated USING (public.is_admin());

-- PAYROLL
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
CREATE POLICY "payroll read authenticated" ON public.payroll FOR SELECT TO authenticated USING (true);
CREATE POLICY "payroll insert admin" ON public.payroll FOR INSERT TO authenticated WITH CHECK (public.is_admin());
CREATE POLICY "payroll update admin" ON public.payroll FOR UPDATE TO authenticated USING (public.is_admin()) WITH CHECK (public.is_admin());
CREATE POLICY "payroll delete admin" ON public.payroll FOR DELETE TO authenticated USING (public.is_admin());

-- REPORTS
CREATE TABLE public.reports (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  generated_at timestamptz NOT NULL DEFAULT now(),
  content text,
  month date
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.reports TO authenticated;
GRANT ALL ON public.reports TO service_role;
ALTER TABLE public.reports ENABLE ROW LEVEL SECURITY;
CREATE POLICY "reports read authenticated" ON public.reports FOR SELECT TO authenticated USING (true);
CREATE POLICY "reports insert admin" ON public.reports FOR INSERT TO authenticated WITH CHECK (public.is_admin());
CREATE POLICY "reports update admin" ON public.reports FOR UPDATE TO authenticated USING (public.is_admin()) WITH CHECK (public.is_admin());
CREATE POLICY "reports delete admin" ON public.reports FOR DELETE TO authenticated USING (public.is_admin());

-- BUSINESS LOGIC
-- صافي الراتب = الأساسي + البدلات - (أيام الغياب × الأساسي/30) - الخصومات
CREATE OR REPLACE FUNCTION public.calculate_net_salary(
  _employee_id uuid,
  _month date,
  _bonuses numeric DEFAULT 0,
  _deductions numeric DEFAULT 0
) RETURNS numeric
LANGUAGE plpgsql STABLE SECURITY DEFINER SET search_path = public AS $$
DECLARE
  _base numeric;
  _absent_days int;
BEGIN
  SELECT base_salary INTO _base FROM public.employees WHERE id = _employee_id;
  IF _base IS NULL THEN RETURN NULL; END IF;

  SELECT count(*) INTO _absent_days
  FROM public.attendance
  WHERE employee_id = _employee_id
    AND status = 'absent'
    AND date >= date_trunc('month', _month)::date
    AND date < (date_trunc('month', _month) + interval '1 month')::date;

  RETURN round(_base + COALESCE(_bonuses,0) - (_absent_days * (_base / 30.0)) - COALESCE(_deductions,0), 2);
END;
$$;

-- نسبة الحضور الشهرية (present + late) / إجمالي السجلات
CREATE OR REPLACE FUNCTION public.monthly_attendance_rate(_employee_id uuid, _month date)
RETURNS numeric
LANGUAGE plpgsql STABLE SECURITY DEFINER SET search_path = public AS $$
DECLARE
  _total int;
  _attended int;
BEGIN
  SELECT count(*), count(*) FILTER (WHERE status IN ('present','late'))
  INTO _total, _attended
  FROM public.attendance
  WHERE employee_id = _employee_id
    AND date >= date_trunc('month', _month)::date
    AND date < (date_trunc('month', _month) + interval '1 month')::date;

  IF _total = 0 THEN RETURN 0; END IF;
  RETURN round((_attended::numeric / _total::numeric) * 100, 2);
END;
$$;

-- حفظ صافي الراتب تلقائيًا عند الإدخال/التعديل
CREATE OR REPLACE FUNCTION public.payroll_set_net_salary()
RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
BEGIN
  IF NEW.base_salary IS NULL OR NEW.base_salary = 0 THEN
    SELECT base_salary INTO NEW.base_salary FROM public.employees WHERE id = NEW.employee_id;
  END IF;
  NEW.net_salary := public.calculate_net_salary(NEW.employee_id, NEW.month, NEW.bonuses, NEW.deductions);
  RETURN NEW;
END;
$$;

CREATE TRIGGER trg_payroll_net_salary
BEFORE INSERT OR UPDATE ON public.payroll
FOR EACH ROW EXECUTE FUNCTION public.payroll_set_net_salary();

CREATE OR REPLACE FUNCTION public.update_updated_at_column()
RETURNS trigger LANGUAGE plpgsql SET search_path = public AS $$
BEGIN NEW.updated_at = now(); RETURN NEW; END; $$;

CREATE TRIGGER trg_employees_updated_at
BEFORE UPDATE ON public.employees
FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();
