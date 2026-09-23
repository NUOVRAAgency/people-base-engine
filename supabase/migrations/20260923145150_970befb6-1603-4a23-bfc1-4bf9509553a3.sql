CREATE SCHEMA IF NOT EXISTS private;
REVOKE ALL ON SCHEMA private FROM PUBLIC, anon;
GRANT USAGE ON SCHEMA private TO authenticated, service_role;

ALTER FUNCTION public.is_admin() SET SCHEMA private;
ALTER FUNCTION public.is_operator() SET SCHEMA private;
ALTER FUNCTION public.is_viewer() SET SCHEMA private;
ALTER FUNCTION public.get_user_branch_id() SET SCHEMA private;
ALTER FUNCTION public.get_employee_branch_id(uuid) SET SCHEMA private;

REVOKE ALL ON FUNCTION private.is_admin() FROM PUBLIC, anon;
REVOKE ALL ON FUNCTION private.is_operator() FROM PUBLIC, anon;
REVOKE ALL ON FUNCTION private.is_viewer() FROM PUBLIC, anon;
REVOKE ALL ON FUNCTION private.get_user_branch_id() FROM PUBLIC, anon;
REVOKE ALL ON FUNCTION private.get_employee_branch_id(uuid) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION private.is_admin() TO authenticated, service_role;
GRANT EXECUTE ON FUNCTION private.is_operator() TO authenticated, service_role;
GRANT EXECUTE ON FUNCTION private.is_viewer() TO authenticated, service_role;
GRANT EXECUTE ON FUNCTION private.get_user_branch_id() TO authenticated, service_role;
GRANT EXECUTE ON FUNCTION private.get_employee_branch_id(uuid) TO authenticated, service_role;