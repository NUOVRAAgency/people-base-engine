GRANT EXECUTE ON FUNCTION public.is_admin() TO authenticated;
GRANT EXECUTE ON FUNCTION public.is_operator() TO authenticated;
GRANT EXECUTE ON FUNCTION public.is_viewer() TO authenticated;
GRANT EXECUTE ON FUNCTION public.get_user_branch_id() TO authenticated;
GRANT EXECUTE ON FUNCTION public.get_employee_branch_id(uuid) TO authenticated;