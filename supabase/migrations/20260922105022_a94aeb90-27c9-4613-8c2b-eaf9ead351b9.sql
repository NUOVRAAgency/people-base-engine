DROP POLICY IF EXISTS "roles read own or admin" ON public.user_roles;
CREATE POLICY "roles read own"
ON public.user_roles
FOR SELECT
TO authenticated
USING (user_id = auth.uid());