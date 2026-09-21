-- 1) إبعاد البيانات المالية عن جدول الموظفين
ALTER TABLE public.employees DROP COLUMN IF EXISTS base_salary;

-- 2) إعادة تعريف حساب صافي الراتب اعتماداً على سجل الرواتب + حصره بالمدير
DROP FUNCTION IF EXISTS public.calculate_net_salary(uuid, date, numeric, numeric);

CREATE OR REPLACE FUNCTION public.calculate_net_salary(
  _employee_id uuid,
  _month date,
  _base_salary numeric,
  _bonuses numeric DEFAULT 0,
  _deductions numeric DEFAULT 0
)
RETURNS numeric
LANGUAGE plpgsql
STABLE SECURITY DEFINER
SET search_path TO 'public'
AS $function$
DECLARE
  _absent_days int;
BEGIN
  IF NOT public.is_admin() THEN
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

-- 3) المشغّل يعتمد على الراتب الأساسي المخزّن في سجل الرواتب
CREATE OR REPLACE FUNCTION public.payroll_set_net_salary()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $function$
DECLARE
  _absent_days int;
BEGIN
  SELECT count(*) INTO _absent_days
  FROM public.attendance
  WHERE employee_id = NEW.employee_id
    AND status = 'absent'
    AND date >= date_trunc('month', NEW.month)::date
    AND date < (date_trunc('month', NEW.month) + interval '1 month')::date;

  NEW.net_salary := round(
    COALESCE(NEW.base_salary,0) + COALESCE(NEW.bonuses,0)
    - (_absent_days * (COALESCE(NEW.base_salary,0) / 30.0))
    - COALESCE(NEW.deductions,0), 2);
  RETURN NEW;
END;
$function$;

-- 4) حماية بيانات الرواتب: القراءة للمدير فقط
DROP POLICY IF EXISTS "payroll read authenticated" ON public.payroll;
CREATE POLICY "payroll read admin only"
  ON public.payroll FOR SELECT TO authenticated
  USING (public.is_admin());

REVOKE ALL ON public.payroll FROM anon;
GRANT SELECT, INSERT, UPDATE, DELETE ON public.payroll TO authenticated;
GRANT ALL ON public.payroll TO service_role;