
ALTER TABLE public.payroll
  ADD COLUMN IF NOT EXISTS overtime_hours numeric NOT NULL DEFAULT 0 CHECK (overtime_hours >= 0),
  ADD COLUMN IF NOT EXISTS overtime_amount numeric NOT NULL DEFAULT 0 CHECK (overtime_amount >= 0),
  ADD COLUMN IF NOT EXISTS status text NOT NULL DEFAULT 'draft';

ALTER TABLE public.payroll
  DROP CONSTRAINT IF EXISTS payroll_status_check;
ALTER TABLE public.payroll
  ADD CONSTRAINT payroll_status_check CHECK (status IN ('draft','review','approved'));

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
    + COALESCE(NEW.overtime_amount,0)
    + COALESCE(NEW.bonuses,0)
    - (_absent_days * (COALESCE(NEW.base_salary,0) / 30.0))
    - COALESCE(NEW.deductions,0), 2);
  RETURN NEW;
END;
$function$;

CREATE TABLE IF NOT EXISTS public.payroll_adjustments (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  employee_id uuid NOT NULL REFERENCES public.employees(id) ON DELETE CASCADE,
  month date NOT NULL,
  kind text NOT NULL CHECK (kind IN ('addition','deduction')),
  label text NOT NULL CHECK (char_length(btrim(label)) BETWEEN 2 AND 120),
  amount numeric(12,2) NOT NULL CHECK (amount >= 0),
  note text,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.payroll_adjustments TO authenticated;
GRANT ALL ON public.payroll_adjustments TO service_role;
ALTER TABLE public.payroll_adjustments ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "adjustments read admin" ON public.payroll_adjustments;
CREATE POLICY "adjustments read admin" ON public.payroll_adjustments
  FOR SELECT TO authenticated USING (private.is_admin());
DROP POLICY IF EXISTS "adjustments insert admin" ON public.payroll_adjustments;
CREATE POLICY "adjustments insert admin" ON public.payroll_adjustments
  FOR INSERT TO authenticated WITH CHECK (private.is_admin());
DROP POLICY IF EXISTS "adjustments update admin" ON public.payroll_adjustments;
CREATE POLICY "adjustments update admin" ON public.payroll_adjustments
  FOR UPDATE TO authenticated USING (private.is_admin()) WITH CHECK (private.is_admin());
DROP POLICY IF EXISTS "adjustments delete admin" ON public.payroll_adjustments;
CREATE POLICY "adjustments delete admin" ON public.payroll_adjustments
  FOR DELETE TO authenticated USING (private.is_admin());

DROP TRIGGER IF EXISTS trg_payroll_adjustments_updated_at ON public.payroll_adjustments;
CREATE TRIGGER trg_payroll_adjustments_updated_at
BEFORE UPDATE ON public.payroll_adjustments
FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

CREATE INDEX IF NOT EXISTS payroll_adjustments_employee_month_idx
  ON public.payroll_adjustments (employee_id, month);

CREATE TABLE IF NOT EXISTS public.employee_loans (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  employee_id uuid NOT NULL REFERENCES public.employees(id) ON DELETE CASCADE,
  total_amount numeric(12,2) NOT NULL CHECK (total_amount > 0),
  monthly_installment numeric(12,2) NOT NULL CHECK (monthly_installment > 0),
  paid_amount numeric(12,2) NOT NULL DEFAULT 0 CHECK (paid_amount >= 0),
  start_month date NOT NULL,
  status text NOT NULL DEFAULT 'active' CHECK (status IN ('active','closed')),
  note text,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.employee_loans TO authenticated;
GRANT ALL ON public.employee_loans TO service_role;
ALTER TABLE public.employee_loans ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "loans read admin" ON public.employee_loans;
CREATE POLICY "loans read admin" ON public.employee_loans
  FOR SELECT TO authenticated USING (private.is_admin());
DROP POLICY IF EXISTS "loans insert admin" ON public.employee_loans;
CREATE POLICY "loans insert admin" ON public.employee_loans
  FOR INSERT TO authenticated WITH CHECK (private.is_admin());
DROP POLICY IF EXISTS "loans update admin" ON public.employee_loans;
CREATE POLICY "loans update admin" ON public.employee_loans
  FOR UPDATE TO authenticated USING (private.is_admin()) WITH CHECK (private.is_admin());
DROP POLICY IF EXISTS "loans delete admin" ON public.employee_loans;
CREATE POLICY "loans delete admin" ON public.employee_loans
  FOR DELETE TO authenticated USING (private.is_admin());

DROP TRIGGER IF EXISTS trg_employee_loans_updated_at ON public.employee_loans;
CREATE TRIGGER trg_employee_loans_updated_at
BEFORE UPDATE ON public.employee_loans
FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

CREATE INDEX IF NOT EXISTS employee_loans_employee_idx ON public.employee_loans (employee_id);
