
REVOKE EXECUTE ON FUNCTION public.has_role(uuid, public.app_role) FROM PUBLIC, anon;
REVOKE EXECUTE ON FUNCTION public.is_admin() FROM PUBLIC, anon;
REVOKE EXECUTE ON FUNCTION public.calculate_net_salary(uuid, date, numeric, numeric) FROM PUBLIC, anon;
REVOKE EXECUTE ON FUNCTION public.monthly_attendance_rate(uuid, date) FROM PUBLIC, anon;
REVOKE EXECUTE ON FUNCTION public.handle_new_user() FROM PUBLIC, anon, authenticated;
REVOKE EXECUTE ON FUNCTION public.payroll_set_net_salary() FROM PUBLIC, anon, authenticated;
REVOKE EXECUTE ON FUNCTION public.update_updated_at_column() FROM PUBLIC, anon, authenticated;

GRANT EXECUTE ON FUNCTION public.has_role(uuid, public.app_role) TO authenticated;
GRANT EXECUTE ON FUNCTION public.is_admin() TO authenticated;
GRANT EXECUTE ON FUNCTION public.calculate_net_salary(uuid, date, numeric, numeric) TO authenticated;
GRANT EXECUTE ON FUNCTION public.monthly_attendance_rate(uuid, date) TO authenticated;
