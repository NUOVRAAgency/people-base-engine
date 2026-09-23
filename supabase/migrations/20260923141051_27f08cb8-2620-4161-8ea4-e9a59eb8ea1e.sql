REVOKE ALL ON FUNCTION public.has_approved_leave(uuid, date) FROM PUBLIC, anon, authenticated;
REVOKE ALL ON FUNCTION public.unjustified_absent_days(uuid, date) FROM PUBLIC, anon, authenticated;
REVOKE ALL ON FUNCTION public.leave_requests_guard() FROM PUBLIC, anon, authenticated;