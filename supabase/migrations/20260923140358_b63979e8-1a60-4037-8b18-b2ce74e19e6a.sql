-- 1. Admin can read all user_roles rows
CREATE POLICY "roles admin select all"
ON public.user_roles
FOR SELECT
TO authenticated
USING (public.is_admin());

-- 2. Only admin can change any user's role (including own row)
CREATE POLICY "roles admin update"
ON public.user_roles
FOR UPDATE
TO authenticated
USING (public.is_admin())
WITH CHECK (public.is_admin());

-- 3. Grant UPDATE so the policy can actually execute via the Data API
GRANT UPDATE ON public.user_roles TO authenticated;
GRANT SELECT ON public.user_roles TO service_role;