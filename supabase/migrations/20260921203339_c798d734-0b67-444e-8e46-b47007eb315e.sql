
-- 1) الفروع
CREATE TABLE public.branches (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  name text NOT NULL,
  location text,
  status text NOT NULL DEFAULT 'active',
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

GRANT SELECT, INSERT, UPDATE, DELETE ON public.branches TO authenticated;
GRANT ALL ON public.branches TO service_role;

ALTER TABLE public.branches ENABLE ROW LEVEL SECURITY;

CREATE POLICY "branches read authenticated" ON public.branches
  FOR SELECT TO authenticated USING (true);
CREATE POLICY "branches insert admin" ON public.branches
  FOR INSERT TO authenticated WITH CHECK (public.is_admin());
CREATE POLICY "branches update admin" ON public.branches
  FOR UPDATE TO authenticated USING (public.is_admin()) WITH CHECK (public.is_admin());
CREATE POLICY "branches delete admin" ON public.branches
  FOR DELETE TO authenticated USING (public.is_admin());

CREATE TRIGGER trg_branches_updated_at
  BEFORE UPDATE ON public.branches
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

-- 2) ربط الموظفين والمستخدمين بالفرع
ALTER TABLE public.employees ADD COLUMN branch_id uuid REFERENCES public.branches(id) ON DELETE SET NULL;
ALTER TABLE public.users ADD COLUMN branch_id uuid REFERENCES public.branches(id) ON DELETE SET NULL;

CREATE INDEX idx_employees_branch_id ON public.employees(branch_id);
CREATE INDEX idx_users_branch_id ON public.users(branch_id);

-- دور جديد
ALTER TYPE public.app_role ADD VALUE IF NOT EXISTS 'operator';

-- 3) دوال مساعدة (SECURITY DEFINER لتجاوز RLS ومنع التكرار اللانهائي)
CREATE OR REPLACE FUNCTION public.get_user_branch_id()
RETURNS uuid
LANGUAGE sql
STABLE SECURITY DEFINER
SET search_path = public
AS $$
  SELECT branch_id FROM public.users WHERE id = auth.uid();
$$;

CREATE OR REPLACE FUNCTION public.has_role_name(_user_id uuid, _role text)
RETURNS boolean
LANGUAGE sql
STABLE SECURITY DEFINER
SET search_path = public
AS $$
  SELECT EXISTS (
    SELECT 1 FROM public.user_roles
    WHERE user_id = _user_id AND role::text = _role
  );
$$;

CREATE OR REPLACE FUNCTION public.is_operator()
RETURNS boolean
LANGUAGE sql
STABLE SECURITY DEFINER
SET search_path = public
AS $$ SELECT public.has_role_name(auth.uid(), 'operator'); $$;

CREATE OR REPLACE FUNCTION public.is_viewer()
RETURNS boolean
LANGUAGE sql
STABLE SECURITY DEFINER
SET search_path = public
AS $$ SELECT public.has_role_name(auth.uid(), 'viewer'); $$;

-- الفرع الخاص بموظف معيّن (لاستخدامه في سياسات الحضور دون RLS متكرر)
CREATE OR REPLACE FUNCTION public.get_employee_branch_id(_employee_id uuid)
RETURNS uuid
LANGUAGE sql
STABLE SECURITY DEFINER
SET search_path = public
AS $$ SELECT branch_id FROM public.employees WHERE id = _employee_id; $$;

-- 4) إعادة تعريف سياسات الموظفين
DROP POLICY IF EXISTS "employees read authenticated" ON public.employees;
DROP POLICY IF EXISTS "employees insert admin" ON public.employees;
DROP POLICY IF EXISTS "employees update admin" ON public.employees;
DROP POLICY IF EXISTS "employees delete admin" ON public.employees;

CREATE POLICY "employees select by role and branch" ON public.employees
  FOR SELECT TO authenticated
  USING (
    public.is_admin()
    OR (
      (public.is_operator() OR public.is_viewer())
      AND branch_id IS NOT NULL
      AND branch_id = public.get_user_branch_id()
    )
  );

CREATE POLICY "employees insert admin or operator branch" ON public.employees
  FOR INSERT TO authenticated
  WITH CHECK (
    public.is_admin()
    OR (
      public.is_operator()
      AND branch_id IS NOT NULL
      AND branch_id = public.get_user_branch_id()
    )
  );

CREATE POLICY "employees update admin or operator branch" ON public.employees
  FOR UPDATE TO authenticated
  USING (
    public.is_admin()
    OR (
      public.is_operator()
      AND branch_id IS NOT NULL
      AND branch_id = public.get_user_branch_id()
    )
  )
  WITH CHECK (
    public.is_admin()
    OR (
      public.is_operator()
      AND branch_id IS NOT NULL
      AND branch_id = public.get_user_branch_id()
    )
  );

CREATE POLICY "employees delete admin only" ON public.employees
  FOR DELETE TO authenticated
  USING (public.is_admin());

-- 5) سياسات الحضور بفلترة الفرع
DROP POLICY IF EXISTS "attendance read authenticated" ON public.attendance;
DROP POLICY IF EXISTS "attendance insert admin" ON public.attendance;
DROP POLICY IF EXISTS "attendance update admin" ON public.attendance;
DROP POLICY IF EXISTS "attendance delete admin" ON public.attendance;

CREATE POLICY "attendance select by role and branch" ON public.attendance
  FOR SELECT TO authenticated
  USING (
    public.is_admin()
    OR (
      (public.is_operator() OR public.is_viewer())
      AND public.get_employee_branch_id(employee_id) IS NOT NULL
      AND public.get_employee_branch_id(employee_id) = public.get_user_branch_id()
    )
  );

CREATE POLICY "attendance insert admin or operator branch" ON public.attendance
  FOR INSERT TO authenticated
  WITH CHECK (
    public.is_admin()
    OR (
      public.is_operator()
      AND public.get_employee_branch_id(employee_id) IS NOT NULL
      AND public.get_employee_branch_id(employee_id) = public.get_user_branch_id()
    )
  );

CREATE POLICY "attendance update admin or operator branch" ON public.attendance
  FOR UPDATE TO authenticated
  USING (
    public.is_admin()
    OR (
      public.is_operator()
      AND public.get_employee_branch_id(employee_id) IS NOT NULL
      AND public.get_employee_branch_id(employee_id) = public.get_user_branch_id()
    )
  )
  WITH CHECK (
    public.is_admin()
    OR (
      public.is_operator()
      AND public.get_employee_branch_id(employee_id) IS NOT NULL
      AND public.get_employee_branch_id(employee_id) = public.get_user_branch_id()
    )
  );

CREATE POLICY "attendance delete admin only" ON public.attendance
  FOR DELETE TO authenticated
  USING (public.is_admin());
