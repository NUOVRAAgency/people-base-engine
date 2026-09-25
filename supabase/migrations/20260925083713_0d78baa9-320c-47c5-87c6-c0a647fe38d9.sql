ALTER TABLE public.users ADD COLUMN IF NOT EXISTS full_name text;

UPDATE public.users SET full_name = 'وجدي العريفي' WHERE email = 'wjdyalryfy9@gmail.com';

GRANT SELECT ON public.users TO authenticated;
GRANT ALL ON public.users TO service_role;