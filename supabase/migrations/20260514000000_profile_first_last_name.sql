-- Agrega first_name y last_name a profiles para distinguirlos en admin.
-- full_name se mantiene como antes (compatibilidad con todo el resto del código).

ALTER TABLE public.profiles
  ADD COLUMN IF NOT EXISTS first_name TEXT,
  ADD COLUMN IF NOT EXISTS last_name TEXT;

-- Backfill: para usuarios existentes, separar full_name por el PRIMER espacio.
-- "Maria Lopez Garcia" -> first_name="Maria", last_name="Lopez Garcia".
-- Solo aplicamos si first_name/last_name están vacíos (no pisar datos cargados a mano).
UPDATE public.profiles
SET
  first_name = NULLIF(split_part(full_name, ' ', 1), ''),
  last_name  = NULLIF(NULLIF(trim(substring(full_name from position(' ' in full_name) + 1)), full_name), '')
WHERE
  full_name IS NOT NULL
  AND full_name <> ''
  AND first_name IS NULL
  AND last_name IS NULL;

-- Trigger actualizado: lee first_name/last_name de raw_user_meta_data si vienen
-- separados (signup form propio), y los compone en full_name para mantener
-- compatibilidad. Si solo viene full_name (caso Google OAuth), lo guarda como antes
-- y deja first_name como primera palabra y last_name como el resto.
CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
DECLARE
  meta_first TEXT := NEW.raw_user_meta_data->>'first_name';
  meta_last  TEXT := NEW.raw_user_meta_data->>'last_name';
  meta_full  TEXT := NEW.raw_user_meta_data->>'full_name';
  resolved_first TEXT;
  resolved_last  TEXT;
  resolved_full  TEXT;
BEGIN
  IF meta_first IS NOT NULL OR meta_last IS NOT NULL THEN
    -- Signup propio: vienen separados.
    resolved_first := COALESCE(meta_first, '');
    resolved_last  := COALESCE(meta_last, '');
    resolved_full  := trim(resolved_first || ' ' || resolved_last);
  ELSIF meta_full IS NOT NULL AND meta_full <> '' THEN
    -- Google / OAuth: solo viene full_name.
    resolved_full  := meta_full;
    resolved_first := NULLIF(split_part(meta_full, ' ', 1), '');
    resolved_last  := NULLIF(trim(substring(meta_full from position(' ' in meta_full) + 1)), '');
    IF resolved_last = resolved_full THEN resolved_last := NULL; END IF;
  ELSE
    resolved_full  := '';
    resolved_first := NULL;
    resolved_last  := NULL;
  END IF;

  INSERT INTO public.profiles (id, email, full_name, first_name, last_name)
  VALUES (NEW.id, NEW.email, resolved_full, resolved_first, resolved_last)
  ON CONFLICT (id) DO UPDATE SET
    email      = EXCLUDED.email,
    full_name  = COALESCE(EXCLUDED.full_name,  public.profiles.full_name),
    first_name = COALESCE(EXCLUDED.first_name, public.profiles.first_name),
    last_name  = COALESCE(EXCLUDED.last_name,  public.profiles.last_name);
  RETURN NEW;
EXCEPTION WHEN OTHERS THEN
  RAISE WARNING 'handle_new_user failed for %: %', NEW.id, SQLERRM;
  RETURN NEW;
END;
$$;
