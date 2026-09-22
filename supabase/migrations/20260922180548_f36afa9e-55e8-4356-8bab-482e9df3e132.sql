ALTER TABLE public.users ADD COLUMN avatar_path text;

CREATE TABLE public.app_settings (
  id text PRIMARY KEY DEFAULT 'organization' CHECK (id = 'organization'),
  logo_path text,
  updated_at timestamp with time zone NOT NULL DEFAULT now(),
  updated_by uuid REFERENCES auth.users(id) ON DELETE SET NULL
);

GRANT SELECT ON public.app_settings TO authenticated;
GRANT INSERT, UPDATE, DELETE ON public.app_settings TO authenticated;
GRANT ALL ON public.app_settings TO service_role;
ALTER TABLE public.app_settings ENABLE ROW LEVEL SECURITY;
CREATE POLICY "settings authenticated read" ON public.app_settings FOR SELECT TO authenticated USING (true);
CREATE POLICY "settings admin insert" ON public.app_settings FOR INSERT TO authenticated WITH CHECK (public.is_admin());
CREATE POLICY "settings admin update" ON public.app_settings FOR UPDATE TO authenticated USING (public.is_admin()) WITH CHECK (public.is_admin());
CREATE POLICY "settings admin delete" ON public.app_settings FOR DELETE TO authenticated USING (public.is_admin());
CREATE TRIGGER trg_app_settings_updated_at BEFORE UPDATE ON public.app_settings FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

INSERT INTO public.app_settings (id) VALUES ('organization') ON CONFLICT (id) DO NOTHING;

CREATE POLICY "branding authenticated read" ON storage.objects FOR SELECT TO authenticated USING (bucket_id = 'hr-branding');
CREATE POLICY "users upload own avatar" ON storage.objects FOR INSERT TO authenticated WITH CHECK (bucket_id = 'hr-branding' AND (storage.foldername(name))[1] = 'avatars' AND (storage.foldername(name))[2] = auth.uid()::text);
CREATE POLICY "users update own avatar" ON storage.objects FOR UPDATE TO authenticated USING (bucket_id = 'hr-branding' AND (storage.foldername(name))[1] = 'avatars' AND (storage.foldername(name))[2] = auth.uid()::text) WITH CHECK (bucket_id = 'hr-branding' AND (storage.foldername(name))[1] = 'avatars' AND (storage.foldername(name))[2] = auth.uid()::text);
CREATE POLICY "users delete own avatar" ON storage.objects FOR DELETE TO authenticated USING (bucket_id = 'hr-branding' AND (storage.foldername(name))[1] = 'avatars' AND (storage.foldername(name))[2] = auth.uid()::text);
CREATE POLICY "admin upload organization logo" ON storage.objects FOR INSERT TO authenticated WITH CHECK (bucket_id = 'hr-branding' AND (storage.foldername(name))[1] = 'organization' AND public.is_admin());
CREATE POLICY "admin update organization logo" ON storage.objects FOR UPDATE TO authenticated USING (bucket_id = 'hr-branding' AND (storage.foldername(name))[1] = 'organization' AND public.is_admin()) WITH CHECK (bucket_id = 'hr-branding' AND (storage.foldername(name))[1] = 'organization' AND public.is_admin());
CREATE POLICY "admin delete organization logo" ON storage.objects FOR DELETE TO authenticated USING (bucket_id = 'hr-branding' AND (storage.foldername(name))[1] = 'organization' AND public.is_admin());