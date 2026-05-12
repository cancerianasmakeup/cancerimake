-- LIVE: historial completo + estado "pending_recovery" para clientas que ganaron y no pagaron.
-- También un trigger que cuando arranca un LIVE nuevo, marca a todos los pendientes para notificar.

-- 1) Nuevo estado: pending_recovery (admin "guarda" la oferta para que la clienta la complete después)
ALTER TYPE live_purchase_status ADD VALUE IF NOT EXISTS 'pending_recovery';

-- 2) Columnas nuevas en live_purchases
ALTER TABLE live_purchases
  ADD COLUMN IF NOT EXISTS admin_notes TEXT,
  ADD COLUMN IF NOT EXISTS recovery_notified_at TIMESTAMPTZ,
  ADD COLUMN IF NOT EXISTS marked_by UUID REFERENCES profiles(id) ON DELETE SET NULL;

-- 3) Columnas nuevas en live_events (notas + flag de auto-save al finalizar)
ALTER TABLE live_events
  ADD COLUMN IF NOT EXISTS notes TEXT,
  ADD COLUMN IF NOT EXISTS auto_save_pending BOOLEAN NOT NULL DEFAULT TRUE;

-- 4) RPC: admin marca una compra individual como pending_recovery
CREATE OR REPLACE FUNCTION public.mark_pending_recovery(
  p_purchase_id UUID,
  p_note TEXT DEFAULT NULL
)
RETURNS BOOLEAN
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
BEGIN
  IF NOT public.is_admin() THEN
    RAISE EXCEPTION 'No tenés permisos';
  END IF;

  UPDATE live_purchases
  SET status = 'pending_recovery'::live_purchase_status,
      admin_notes = COALESCE(p_note, admin_notes),
      marked_by = auth.uid(),
      updated_at = now()
  WHERE id = p_purchase_id
    AND status IN ('expired'::live_purchase_status, 'cancelled'::live_purchase_status, 'queued'::live_purchase_status, 'paying'::live_purchase_status);

  RETURN FOUND;
END;
$$;

-- 5) RPC: bulk save de todos los expired/cancelled de un evento como pending_recovery
CREATE OR REPLACE FUNCTION public.bulk_save_event_pending(p_event_id UUID)
RETURNS INTEGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
DECLARE
  cnt INTEGER;
BEGIN
  IF NOT public.is_admin() THEN
    RAISE EXCEPTION 'No tenés permisos';
  END IF;

  UPDATE live_purchases
  SET status = 'pending_recovery'::live_purchase_status,
      marked_by = auth.uid(),
      updated_at = now()
  WHERE event_id = p_event_id
    AND status IN ('expired'::live_purchase_status, 'cancelled'::live_purchase_status);

  GET DIAGNOSTICS cnt = ROW_COUNT;
  RETURN cnt;
END;
$$;

-- 6) RPC: revertir pending_recovery a cancelled (admin descarta)
CREATE OR REPLACE FUNCTION public.discard_pending_recovery(p_purchase_id UUID)
RETURNS BOOLEAN
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
BEGIN
  IF NOT public.is_admin() THEN
    RAISE EXCEPTION 'No tenés permisos';
  END IF;

  UPDATE live_purchases
  SET status = 'cancelled'::live_purchase_status,
      updated_at = now()
  WHERE id = p_purchase_id AND status = 'pending_recovery'::live_purchase_status;

  RETURN FOUND;
END;
$$;

-- 7) Trigger: cuando un LIVE pasa a 'active', resetea recovery_notified_at de todos los pendientes
-- (así el sistema de notificaciones los re-notifica para el nuevo evento)
CREATE OR REPLACE FUNCTION public.flag_pendings_on_event_active()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
BEGIN
  IF NEW.status = 'active'::live_event_status
     AND OLD.status IS DISTINCT FROM 'active'::live_event_status
  THEN
    UPDATE live_purchases
    SET recovery_notified_at = NULL,
        updated_at = now()
    WHERE status = 'pending_recovery'::live_purchase_status
      AND (recovery_notified_at IS NULL OR recovery_notified_at < (NEW.started_at - interval '1 day'));
  END IF;
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_flag_pendings_on_event_active ON live_events;
CREATE TRIGGER trg_flag_pendings_on_event_active
  AFTER UPDATE OF status ON live_events
  FOR EACH ROW EXECUTE FUNCTION public.flag_pendings_on_event_active();

-- 8) Vista: snapshot por evento con stats consolidados (para listings)
CREATE OR REPLACE VIEW public.live_event_stats AS
SELECT
  e.id,
  e.title,
  e.type,
  e.status,
  e.cover_image,
  e.started_at,
  e.finished_at,
  e.created_at,
  COUNT(DISTINCT p.user_id) FILTER (WHERE p.status = 'paid') AS paid_buyers,
  COUNT(p.id) FILTER (WHERE p.status = 'paid') AS paid_count,
  COUNT(p.id) FILTER (WHERE p.status = 'pending_recovery') AS pending_count,
  COUNT(p.id) FILTER (WHERE p.status IN ('expired', 'cancelled')) AS abandoned_count,
  COUNT(p.id) AS total_attempts,
  COALESCE(SUM(p.amount) FILTER (WHERE p.status = 'paid'), 0) AS revenue,
  COALESCE(SUM(p.amount) FILTER (WHERE p.status = 'pending_recovery'), 0) AS pending_revenue
FROM live_events e
LEFT JOIN live_purchases p ON p.event_id = e.id
GROUP BY e.id;

GRANT SELECT ON public.live_event_stats TO anon, authenticated;

-- 9) Grants para los nuevos RPCs
GRANT EXECUTE ON FUNCTION public.mark_pending_recovery TO authenticated;
GRANT EXECUTE ON FUNCTION public.bulk_save_event_pending TO authenticated;
GRANT EXECUTE ON FUNCTION public.discard_pending_recovery TO authenticated;

NOTIFY pgrst, 'reload schema';
