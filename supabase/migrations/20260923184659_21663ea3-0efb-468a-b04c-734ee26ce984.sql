ALTER TABLE public.payroll
  ADD CONSTRAINT payroll_bank_name_length_check CHECK (bank_name IS NULL OR char_length(btrim(bank_name)) BETWEEN 2 AND 100),
  ADD CONSTRAINT payroll_iban_format_check CHECK (iban IS NULL OR iban ~ '^SA[0-9]{22}$');