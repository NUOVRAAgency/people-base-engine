ALTER TABLE public.payroll
  ADD COLUMN bank_name text,
  ADD CONSTRAINT payroll_base_salary_nonnegative_check CHECK (base_salary >= 0),
  ADD CONSTRAINT payroll_bonuses_nonnegative_check CHECK (bonuses >= 0),
  ADD CONSTRAINT payroll_deductions_nonnegative_check CHECK (deductions >= 0);