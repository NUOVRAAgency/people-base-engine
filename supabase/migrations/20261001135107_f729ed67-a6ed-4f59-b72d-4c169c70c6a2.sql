DROP POLICY IF EXISTS "reports read authenticated" ON public.reports;
CREATE POLICY "reports read admin only" ON public.reports FOR SELECT TO authenticated USING (private.is_admin());