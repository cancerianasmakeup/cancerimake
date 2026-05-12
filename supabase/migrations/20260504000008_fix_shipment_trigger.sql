-- Fix: el trigger BEFORE INSERT intentaba crear shipment_events referenciando NEW.id
-- antes de que el shipment exista en la tabla → violaba la FK.
-- Solución: split en 2 triggers — uno BEFORE UPDATE (solo updated_at) y otro AFTER (log event).

DROP TRIGGER IF EXISTS trg_log_shipment_status ON shipments;
DROP FUNCTION IF EXISTS public.log_shipment_status_change();

-- 1) BEFORE UPDATE: solo bumpea updated_at
CREATE OR REPLACE FUNCTION public.bump_shipment_updated_at()
RETURNS TRIGGER
LANGUAGE plpgsql
AS $$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$$;

CREATE TRIGGER trg_bump_shipment_updated_at
  BEFORE UPDATE ON shipments
  FOR EACH ROW EXECUTE FUNCTION public.bump_shipment_updated_at();

-- 2) AFTER INSERT/UPDATE: loguea evento (acá ya existe la fila, FK satisfecha)
CREATE OR REPLACE FUNCTION public.log_shipment_status_change()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
BEGIN
  IF TG_OP = 'INSERT' THEN
    INSERT INTO shipment_events (shipment_id, status, source, message, created_by)
    VALUES (NEW.id, NEW.status, 'admin', 'Envío creado', NEW.created_by);
    RETURN NEW;
  END IF;

  -- UPDATE: solo logueamos si cambió el status
  IF NEW.status IS DISTINCT FROM OLD.status THEN
    INSERT INTO shipment_events (shipment_id, status, source, message)
    VALUES (NEW.id, NEW.status, 'system', 'Cambio automático de estado');
  END IF;

  RETURN NEW;
END;
$$;

CREATE TRIGGER trg_log_shipment_status
  AFTER INSERT OR UPDATE ON shipments
  FOR EACH ROW EXECUTE FUNCTION public.log_shipment_status_change();
