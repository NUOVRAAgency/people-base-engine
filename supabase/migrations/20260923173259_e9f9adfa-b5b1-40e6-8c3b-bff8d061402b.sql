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

CREATE UNIQUE INDEX employees_work_email_unique_idx
  ON public.employees (lower(work_email))
  WHERE work_email IS NOT NULL;
CREATE UNIQUE INDEX employees_national_id_unique_idx
  ON public.employees (national_id)
  WHERE national_id IS NOT NULL;
CREATE INDEX employees_manager_id_idx ON public.employees (manager_id);
CREATE INDEX employees_department_idx ON public.employees (department);

ALTER TABLE public.payroll
  ADD COLUMN housing_allowance numeric NOT NULL DEFAULT 0 CHECK (housing_allowance >= 0),
  ADD COLUMN transport_allowance numeric NOT NULL DEFAULT 0 CHECK (transport_allowance >= 0),
  ADD COLUMN iban text;

CREATE UNIQUE INDEX payroll_employee_month_unique_idx ON public.payroll (employee_id, month);
CREATE INDEX payroll_iban_idx ON public.payroll (iban) WHERE iban IS NOT NULL;

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