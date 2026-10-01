ALTER TABLE public.attendance
  ADD COLUMN absence_decision text NOT NULL DEFAULT 'pending',
  ADD COLUMN decided_by uuid,
  ADD COLUMN decided_at timestamptz;
ALTER TABLE public.attendance ADD CONSTRAINT attendance_absence_decision_chk CHECK (absence_decision IN ('pending','deducted','excused'));

ALTER TABLE public.payroll_adjustments ADD COLUMN attendance_id uuid UNIQUE REFERENCES public.attendance(id) ON DELETE CASCADE;

CREATE TABLE public.absence_decision_log (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  attendance_id uuid NOT NULL REFERENCES public.attendance(id) ON DELETE CASCADE,
  employee_id uuid NOT NULL REFERENCES public.employees(id) ON DELETE CASCADE,
  absence_date date NOT NULL,
  from_decision text NOT NULL,
  to_decision text NOT NULL,
  decided_by uuid,
  created_at timestamptz NOT NULL DEFAULT now()
);
GRANT SELECT ON public.absence_decision_log TO authenticated;
GRANT ALL ON public.absence_decision_log TO service_role;
ALTER TABLE public.absence_decision_log ENABLE ROW LEVEL SECURITY;
CREATE POLICY "absence log select by role and branch" ON public.absence_decision_log FOR SELECT TO authenticated
USING (private.is_admin() OR ((private.is_operator() OR private.is_viewer()) AND private.get_employee_branch_id(employee_id) IS NOT NULL AND private.get_employee_branch_id(employee_id) = private.get_user_branch_id()));
CREATE INDEX absence_log_created_idx ON public.absence_decision_log (created_at DESC);

-- Non-admins can never set decision columns directly; leaving "absent" resets the decision and removes any excuse line.
CREATE OR REPLACE FUNCTION public.attendance_decision_guard()
RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
BEGIN
  IF TG_OP = 'INSERT' THEN
    NEW.absence_decision := 'pending'; NEW.decided_by := NULL; NEW.decided_at := NULL;
    RETURN NEW;
  END IF;
  IF current_setting('app.absence_decision', true) IS DISTINCT FROM 'on' THEN
    NEW.absence_decision := OLD.absence_decision; NEW.decided_by := OLD.decided_by; NEW.decided_at := OLD.decided_at;
  END IF;
  IF OLD.status = 'absent' AND NEW.status <> 'absent' THEN
    NEW.absence_decision := 'pending'; NEW.decided_by := NULL; NEW.decided_at := NULL;
    DELETE FROM public.payroll_adjustments WHERE attendance_id = OLD.id;
  END IF;
  RETURN NEW;
END $$;
CREATE TRIGGER trg_attendance_decision_guard BEFORE INSERT OR UPDATE ON public.attendance FOR EACH ROW EXECUTE FUNCTION public.attendance_decision_guard();

CREATE OR REPLACE FUNCTION public.set_absence_decision(_attendance_id uuid, _decision text)
RETURNS text LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE
  a public.attendance%ROWTYPE;
  p public.payroll%ROWTYPE;
  _old text;
BEGIN
  IF NOT private.is_admin() THEN RAISE EXCEPTION 'forbidden'; END IF;
  IF _decision NOT IN ('pending','deducted','excused') THEN RAISE EXCEPTION 'invalid_decision'; END IF;
  SELECT * INTO a FROM public.attendance WHERE id = _attendance_id FOR UPDATE;
  IF NOT FOUND OR a.status <> 'absent' THEN RAISE EXCEPTION 'not_absent'; END IF;
  SELECT * INTO p FROM public.payroll WHERE employee_id = a.employee_id AND month = date_trunc('month', a.date)::date LIMIT 1;
  IF FOUND AND p.status IN ('approved','paid') THEN RAISE EXCEPTION 'payroll_locked'; END IF;
  _old := a.absence_decision;
  IF _old = _decision THEN RETURN _old; END IF;

  DELETE FROM public.payroll_adjustments WHERE attendance_id = a.id;
  IF _decision = 'excused' THEN
    IF public.has_approved_leave(a.employee_id, a.date) THEN RAISE EXCEPTION 'has_leave'; END IF;
    IF p.id IS NULL THEN RAISE EXCEPTION 'payroll_missing'; END IF;
    -- Same per-day term the payroll trigger deducts: base_salary / 30.0
    INSERT INTO public.payroll_adjustments (employee_id, month, kind, label, amount, attendance_id)
    VALUES (a.employee_id, p.month, 'addition', 'إعفاء من غياب بتاريخ ' || to_char(a.date, 'YYYY-MM-DD'), COALESCE(p.base_salary,0) / 30.0, a.id);
  END IF;

  PERFORM set_config('app.absence_decision', 'on', true);
  UPDATE public.attendance SET absence_decision = _decision,
    decided_by = CASE WHEN _decision = 'pending' THEN NULL ELSE auth.uid() END,
    decided_at = CASE WHEN _decision = 'pending' THEN NULL ELSE now() END
  WHERE id = a.id;
  PERFORM set_config('app.absence_decision', 'off', true);

  INSERT INTO public.absence_decision_log (attendance_id, employee_id, absence_date, from_decision, to_decision, decided_by)
  VALUES (a.id, a.employee_id, a.date, _old, _decision, auth.uid());
  RETURN _old;
END $$;
REVOKE ALL ON FUNCTION public.set_absence_decision(uuid, text) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.set_absence_decision(uuid, text) TO authenticated;

-- Keep excuse lines equal to the current base_salary / 30 if the base salary is edited later.
CREATE OR REPLACE FUNCTION public.payroll_sync_excuse_amounts()
RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
BEGIN
  IF NEW.base_salary IS DISTINCT FROM OLD.base_salary THEN
    UPDATE public.payroll_adjustments SET amount = COALESCE(NEW.base_salary,0) / 30.0
    WHERE employee_id = NEW.employee_id AND month = NEW.month AND attendance_id IS NOT NULL;
  END IF;
  RETURN NEW;
END $$;
CREATE TRIGGER trg_payroll_sync_excuse AFTER UPDATE ON public.payroll FOR EACH ROW EXECUTE FUNCTION public.payroll_sync_excuse_amounts();