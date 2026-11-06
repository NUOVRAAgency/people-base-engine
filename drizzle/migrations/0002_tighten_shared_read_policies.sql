CREATE OR REPLACE FUNCTION private.is_active_member()
RETURNS boolean LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public AS $$
  SELECT EXISTS (
    SELECT 1 FROM public.users u JOIN public.user_roles r ON r.user_id = u.id
    WHERE u.id = auth.uid() AND u.is_active
  );
$$;
REVOKE ALL ON FUNCTION private.is_active_member() FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION private.is_active_member() TO authenticated;

DROP POLICY IF EXISTS "shifts read" ON public.work_shifts;
CREATE POLICY "shifts read" ON public.work_shifts FOR SELECT TO authenticated
  USING (private.is_active_member());

DROP POLICY IF EXISTS "emp shifts read" ON public.employee_shifts;
CREATE POLICY "emp shifts read" ON public.employee_shifts FOR SELECT TO authenticated
  USING (private.is_admin() OR (private.is_active_member() AND private.get_employee_branch_id(employee_id) = private.get_user_branch_id()));

DROP POLICY IF EXISTS "branches read authenticated" ON public.branches;
CREATE POLICY "branches read authenticated" ON public.branches FOR SELECT TO authenticated
  USING (private.is_admin() OR (private.is_active_member() AND id = private.get_user_branch_id()));

DROP POLICY IF EXISTS "settings authenticated read" ON public.app_settings;
CREATE POLICY "settings authenticated read" ON public.app_settings FOR SELECT TO authenticated
  USING (private.is_active_member());

DROP POLICY IF EXISTS "branding authenticated read" ON storage.objects;
CREATE POLICY "branding authenticated read" ON storage.objects FOR SELECT TO authenticated
  USING (bucket_id = 'hr-branding' AND private.is_active_member() AND auth.uid() IS NOT NULL);