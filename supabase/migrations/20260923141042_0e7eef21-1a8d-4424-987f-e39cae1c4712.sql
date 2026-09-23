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

CREATE POLICY "leaves select by role and branch"
ON public.leave_requests FOR SELECT TO authenticated
USING (
  public.is_admin()
  OR ((public.is_operator() OR public.is_viewer())
      AND public.get_employee_branch_id(employee_id) IS NOT NULL
      AND public.get_employee_branch_id(employee_id) = public.get_user_branch_id())
);

CREATE POLICY "leaves insert admin or operator branch"
ON public.leave_requests FOR INSERT TO authenticated
WITH CHECK (
  public.is_admin()
  OR (public.is_operator()
      AND status = 'pending'
      AND approved_by IS NULL
      AND public.get_employee_branch_id(employee_id) IS NOT NULL
      AND public.get_employee_branch_id(employee_id) = public.get_user_branch_id())
);

CREATE POLICY "leaves update admin or operator pending"
ON public.leave_requests FOR UPDATE TO authenticated
USING (
  public.is_admin()
  OR (public.is_operator()
      AND status = 'pending'
      AND public.get_employee_branch_id(employee_id) IS NOT NULL
      AND public.get_employee_branch_id(employee_id) = public.get_user_branch_id())
)
WITH CHECK (
  public.is_admin()
  OR (public.is_operator()
      AND status = 'pending'
      AND approved_by IS NULL
      AND public.get_employee_branch_id(employee_id) IS NOT NULL
      AND public.get_employee_branch_id(employee_id) = public.get_user_branch_id())
);

CREATE POLICY "leaves delete admin only"
ON public.leave_requests FOR DELETE TO authenticated
USING (public.is_admin());

CREATE INDEX idx_leave_requests_employee_dates ON public.leave_requests (employee_id, start_date, end_date);
CREATE INDEX idx_leave_requests_status ON public.leave_requests (status);

CREATE TRIGGER trg_leave_requests_updated_at
BEFORE UPDATE ON public.leave_requests
FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

-- force requested_by / status integrity
CREATE OR REPLACE FUNCTION public.leave_requests_guard()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
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
$$;

CREATE TRIGGER trg_leave_requests_guard
BEFORE INSERT OR UPDATE ON public.leave_requests
FOR EACH ROW EXECUTE FUNCTION public.leave_requests_guard();

-- approved leave check
CREATE OR REPLACE FUNCTION public.has_approved_leave(_employee_id uuid, _date date)
RETURNS boolean
LANGUAGE sql
STABLE SECURITY DEFINER
SET search_path = public
AS $$
  SELECT EXISTS (
    SELECT 1 FROM public.leave_requests
    WHERE employee_id = _employee_id
      AND status = 'approved'
      AND _date BETWEEN start_date AND end_date
  );
$$;

-- unjustified absent days in a month (excludes approved leave)
CREATE OR REPLACE FUNCTION public.unjustified_absent_days(_employee_id uuid, _month date)
RETURNS integer
LANGUAGE sql
STABLE SECURITY DEFINER
SET search_path = public
AS $$
  SELECT count(*)::int
  FROM public.attendance a
  WHERE a.employee_id = _employee_id
    AND a.status = 'absent'
    AND a.date >= date_trunc('month', _month)::date
    AND a.date < (date_trunc('month', _month) + interval '1 month')::date
    AND NOT public.has_approved_leave(a.employee_id, a.date);
$$;

CREATE OR REPLACE FUNCTION public.calculate_net_salary(_employee_id uuid, _month date, _base_salary numeric, _bonuses numeric DEFAULT 0, _deductions numeric DEFAULT 0)
RETURNS numeric
LANGUAGE plpgsql
STABLE
SET search_path TO 'public'
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

CREATE OR REPLACE FUNCTION public.payroll_set_net_salary()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
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

CREATE OR REPLACE FUNCTION public.monthly_attendance_rate(_employee_id uuid, _month date)
RETURNS numeric
LANGUAGE plpgsql
STABLE
SET search_path TO 'public'
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