DROP POLICY IF EXISTS "shifts admin write" ON public.work_shifts;
CREATE POLICY "shifts admin write" ON public.work_shifts FOR ALL TO authenticated USING (private.is_admin()) WITH CHECK (private.is_admin());
DROP POLICY IF EXISTS "emp shifts admin write" ON public.employee_shifts;
CREATE POLICY "emp shifts admin write" ON public.employee_shifts FOR ALL TO authenticated USING (private.is_admin()) WITH CHECK (private.is_admin());