
REVOKE EXECUTE ON FUNCTION public.get_user_branch_id() FROM anon, authenticated, public;
REVOKE EXECUTE ON FUNCTION public.get_employee_branch_id(uuid) FROM anon, authenticated, public;
REVOKE EXECUTE ON FUNCTION public.has_role_name(uuid, text) FROM anon, authenticated, public;
REVOKE EXECUTE ON FUNCTION public.is_operator() FROM anon, authenticated, public;
REVOKE EXECUTE ON FUNCTION public.is_viewer() FROM anon, authenticated, public;
REVOKE EXECUTE ON FUNCTION public.has_role(uuid, public.app_role) FROM anon, public;
REVOKE EXECUTE ON FUNCTION public.is_admin() FROM anon, public;
REVOKE EXECUTE ON FUNCTION public.calculate_net_salary(uuid, date, numeric, numeric, numeric) FROM anon, public;
REVOKE EXECUTE ON FUNCTION public.monthly_attendance_rate(uuid, date) FROM anon, public;
REVOKE EXECUTE ON FUNCTION public.handle_new_user() FROM anon, authenticated, public;
REVOKE EXECUTE ON FUNCTION public.payroll_set_net_salary() FROM anon, authenticated, public;
