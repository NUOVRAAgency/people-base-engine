ALTER TABLE public.users ADD COLUMN must_change_password boolean NOT NULL DEFAULT false;

CREATE OR REPLACE FUNCTION public.users_protect_privileged_columns()
 RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path TO 'public'
AS $function$
BEGIN
  IF auth.uid() IS NOT NULL AND NOT private.is_admin() THEN
    NEW.branch_id := OLD.branch_id;
    NEW.is_active := OLD.is_active;
    NEW.email := OLD.email;
    NEW.must_change_password := OLD.must_change_password;
  END IF;
  RETURN NEW;
END; $function$;

CREATE OR REPLACE FUNCTION public.users_protect_insert()
 RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path TO 'public'
AS $function$
BEGIN
  IF auth.uid() IS NOT NULL AND NOT private.is_admin() THEN
    NEW.branch_id := NULL;
    NEW.is_active := true;
    NEW.must_change_password := false;
  END IF;
  RETURN NEW;
END; $function$;