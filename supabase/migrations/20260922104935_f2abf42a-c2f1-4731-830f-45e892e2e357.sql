CREATE OR REPLACE FUNCTION public.calculate_net_salary(_employee_id uuid, _month date, _base_salary numeric, _bonuses numeric DEFAULT 0, _deductions numeric DEFAULT 0)
RETURNS numeric
LANGUAGE plpgsql
STABLE
SECURITY INVOKER
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

  SELECT count(*) INTO _absent_days
  FROM public.attendance
  WHERE employee_id = _employee_id
    AND status = 'absent'
    AND date >= date_trunc('month', _month)::date
    AND date < (date_trunc('month', _month) + interval '1 month')::date;

  RETURN round(_base_salary + COALESCE(_bonuses,0) - (_absent_days * (_base_salary / 30.0)) - COALESCE(_deductions,0), 2);
END;
$function$;

CREATE OR REPLACE FUNCTION public.monthly_attendance_rate(_employee_id uuid, _month date)
RETURNS numeric
LANGUAGE plpgsql
STABLE
SECURITY INVOKER
SET search_path TO 'public'
AS $function$
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
$function$;