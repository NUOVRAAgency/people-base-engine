ALTER TABLE public.app_settings
  ADD COLUMN weekend_days smallint[] NOT NULL DEFAULT '{5}',
  ADD COLUMN late_rule_minutes integer NOT NULL DEFAULT 0,
  ADD COLUMN late_rule_fraction numeric NOT NULL DEFAULT 0.25,
  ADD COLUMN currency text NOT NULL DEFAULT 'YER';
ALTER TABLE public.app_settings
  ADD CONSTRAINT app_settings_late_fraction_chk CHECK (late_rule_fraction IN (0.25, 0.5)),
  ADD CONSTRAINT app_settings_late_minutes_chk CHECK (late_rule_minutes BETWEEN 0 AND 600),
  ADD CONSTRAINT app_settings_currency_chk CHECK (currency IN ('YER','SAR','USD')),
  ADD CONSTRAINT app_settings_weekend_chk CHECK (weekend_days <@ '{0,1,2,3,4,5,6}'::smallint[]);

ALTER TABLE public.branches
  ADD COLUMN address text,
  ADD COLUMN manager_employee_id uuid REFERENCES public.employees(id) ON DELETE SET NULL;

-- A weekly day off can never be recorded as an absence.
CREATE OR REPLACE FUNCTION public.attendance_block_weekend_absence()
RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
BEGIN
  IF NEW.status = 'absent' AND EXISTS (
    SELECT 1 FROM public.app_settings WHERE id = 'organization' AND extract(dow FROM NEW.date)::smallint = ANY(weekend_days)
  ) THEN
    RAISE EXCEPTION 'weekend_absence';
  END IF;
  RETURN NEW;
END $$;
REVOKE EXECUTE ON FUNCTION public.attendance_block_weekend_absence() FROM PUBLIC, anon, authenticated;
CREATE TRIGGER trg_attendance_block_weekend BEFORE INSERT OR UPDATE ON public.attendance FOR EACH ROW EXECUTE FUNCTION public.attendance_block_weekend_absence();

-- A branch manager must be an employee of that branch.
CREATE OR REPLACE FUNCTION public.branches_validate_manager()
RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
BEGIN
  IF NEW.manager_employee_id IS NOT NULL AND NOT EXISTS (
    SELECT 1 FROM public.employees WHERE id = NEW.manager_employee_id AND branch_id = NEW.id
  ) THEN
    RAISE EXCEPTION 'manager_not_in_branch';
  END IF;
  RETURN NEW;
END $$;
REVOKE EXECUTE ON FUNCTION public.branches_validate_manager() FROM PUBLIC, anon, authenticated;
CREATE TRIGGER trg_branches_validate_manager BEFORE INSERT OR UPDATE ON public.branches FOR EACH ROW EXECUTE FUNCTION public.branches_validate_manager();