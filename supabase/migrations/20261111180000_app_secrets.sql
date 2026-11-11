-- Server-only secrets (e.g. company Gemini key). No policies: only service_role can read/write.
CREATE TABLE IF NOT EXISTS public.app_secrets (
  id text PRIMARY KEY,
  value text NOT NULL,
  updated_by uuid,
  updated_at timestamptz NOT NULL DEFAULT now()
);
REVOKE ALL ON public.app_secrets FROM anon, authenticated;
GRANT ALL ON public.app_secrets TO service_role;
ALTER TABLE public.app_secrets ENABLE ROW LEVEL SECURITY;
