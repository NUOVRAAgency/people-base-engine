ALTER TABLE public.users ADD COLUMN IF NOT EXISTS is_active boolean NOT NULL DEFAULT true;

CREATE OR REPLACE FUNCTION public.users_protect_privileged_columns()
RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
BEGIN
  IF auth.uid() IS NOT NULL AND NOT private.is_admin() THEN
    NEW.branch_id := OLD.branch_id;
    NEW.is_active := OLD.is_active;
    NEW.email := OLD.email;
  END IF;
  RETURN NEW;
END; $$;

DROP TRIGGER IF EXISTS trg_users_protect_privileged ON public.users;
CREATE TRIGGER trg_users_protect_privileged BEFORE UPDATE ON public.users
FOR EACH ROW EXECUTE FUNCTION public.users_protect_privileged_columns();

CREATE OR REPLACE FUNCTION public.users_protect_insert()
RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
BEGIN
  IF auth.uid() IS NOT NULL AND NOT private.is_admin() THEN
    NEW.branch_id := NULL;
    NEW.is_active := true;
  END IF;
  RETURN NEW;
END; $$;

DROP TRIGGER IF EXISTS trg_users_protect_insert ON public.users;
CREATE TRIGGER trg_users_protect_insert BEFORE INSERT ON public.users
FOR EACH ROW EXECUTE FUNCTION public.users_protect_insert();

REVOKE EXECUTE ON FUNCTION public.users_protect_privileged_columns() FROM PUBLIC, anon, authenticated;
REVOKE EXECUTE ON FUNCTION public.users_protect_insert() FROM PUBLIC, anon, authenticated;