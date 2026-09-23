ALTER TABLE public.payroll DROP CONSTRAINT IF EXISTS payroll_iban_format_check;
DROP INDEX IF EXISTS public.payroll_iban_idx;
ALTER TABLE public.payroll DROP COLUMN IF EXISTS iban;