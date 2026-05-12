-- ============================================================
-- PENDING PACKAGES (paquetes que la admin "separó" en una dinámica
-- y que se acumulan por clienta hasta que se consolidan en un envío)
-- + soporte multi-carrier (Andreani / Correo Argentino)
-- ============================================================
-- Flujo nuevo:
-- 1) En /admin/live/[id] la admin marca "atendida" sobre una live_purchase
--    → RPC mark_purchase_attended() inserta automáticamente una fila en
--      pending_packages con snapshot del item (descripción, monto, refs).
-- 2) Los pending_packages se acumulan por user_id en estado 'pending'.
-- 3) Cuando la admin va a despachar, abre /admin/shipments/new?customer=X,
--    elige cuáles paquetes van en este envío, ingresa peso+medidas, y
--    el RPC consolidate_pending_packages_into_shipment() crea el shipment
--    + marca esos packages como 'shipped' atómicamente.
-- 4) La clienta recibe el link, elige carrier (Andreani/Correo Argentino),
--    carga dirección+sucursal, paga el envío via MP, se genera la etiqueta.

-- ============================================================
-- 0) MULTI-CARRIER: ampliar el enum + columnas genéricas
-- ============================================================
ALTER TYPE shipment_carrier ADD VALUE IF NOT EXISTS 'correo_argentino';

-- Columnas genéricas para cualquier carrier (los datos viejos siguen en andreani_*)
ALTER TABLE shipments
  ADD COLUMN IF NOT EXISTS carrier_tracking_number TEXT,
  ADD COLUMN IF NOT EXISTS carrier_remito TEXT,
  ADD COLUMN IF NOT EXISTS carrier_label_url TEXT,
  ADD COLUMN IF NOT EXISTS carrier_estimated_delivery DATE,
  ADD COLUMN IF NOT EXISTS carrier_response JSONB,
  ADD COLUMN IF NOT EXISTS carrier_last_status TEXT,
  ADD COLUMN IF NOT EXISTS carrier_last_polled_at TIMESTAMPTZ;

-- Backfill: copiar datos existentes de andreani_* a carrier_*
UPDATE shipments
SET carrier_tracking_number    = COALESCE(carrier_tracking_number, andreani_tracking_number),
    carrier_remito             = COALESCE(carrier_remito, andreani_remito),
    carrier_label_url          = COALESCE(carrier_label_url, andreani_label_url),
    carrier_estimated_delivery = COALESCE(carrier_estimated_delivery, andreani_estimated_delivery),
    carrier_response           = COALESCE(carrier_response, andreani_response),
    carrier_last_status        = COALESCE(carrier_last_status, andreani_last_status),
    carrier_last_polled_at     = COALESCE(carrier_last_polled_at, andreani_last_polled_at)
WHERE andreani_tracking_number IS NOT NULL
   OR andreani_remito IS NOT NULL
   OR andreani_label_url IS NOT NULL;

-- Settings default para Correo Argentino (modo mock por defecto)
INSERT INTO site_settings (key, value) VALUES
  ('correo_argentino_status', jsonb_build_object('mode', 'mock', 'last_test', null))
ON CONFLICT (key) DO NOTHING;

-- ============================================================
-- 1) ATTENDED en live_purchases
-- ============================================================
ALTER TABLE live_purchases
  ADD COLUMN IF NOT EXISTS attended_at  TIMESTAMPTZ,
  ADD COLUMN IF NOT EXISTS attended_by  UUID REFERENCES profiles(id) ON DELETE SET NULL;

CREATE INDEX IF NOT EXISTS idx_live_purchases_attended
  ON live_purchases(event_id, attended_at) WHERE attended_at IS NOT NULL;

-- ============================================================
-- 2) PENDING PACKAGES
-- ============================================================
DO $$ BEGIN
  CREATE TYPE pending_package_status AS ENUM ('pending', 'shipped', 'cancelled');
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

CREATE TABLE IF NOT EXISTS pending_packages (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),

  -- A quién pertenece
  user_id UUID NOT NULL REFERENCES profiles(id) ON DELETE RESTRICT,

  -- Origen (cualquiera puede ser null según flujo)
  live_event_id    UUID REFERENCES live_events(id)    ON DELETE SET NULL,
  live_offer_id    UUID REFERENCES live_offers(id)    ON DELETE SET NULL,
  live_purchase_id UUID REFERENCES live_purchases(id) ON DELETE SET NULL UNIQUE,
  order_id         UUID REFERENCES orders(id)         ON DELETE SET NULL,

  -- Snapshot del item (sobrevive al evento si lo borran)
  description TEXT NOT NULL,
  unit_count  INT  NOT NULL DEFAULT 1,
  amount      NUMERIC(10,2) NOT NULL DEFAULT 0,
  image_url   TEXT,

  -- Consolidación
  status      pending_package_status NOT NULL DEFAULT 'pending',
  shipment_id UUID REFERENCES shipments(id) ON DELETE SET NULL,

  -- Metadata
  notes        TEXT,
  created_by   UUID REFERENCES profiles(id) ON DELETE SET NULL,
  created_at   TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at   TIMESTAMPTZ NOT NULL DEFAULT now(),
  shipped_at   TIMESTAMPTZ,
  cancelled_at TIMESTAMPTZ
);

CREATE INDEX IF NOT EXISTS idx_pending_packages_user
  ON pending_packages(user_id, status, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_pending_packages_event
  ON pending_packages(live_event_id) WHERE live_event_id IS NOT NULL;
CREATE INDEX IF NOT EXISTS idx_pending_packages_shipment
  ON pending_packages(shipment_id) WHERE shipment_id IS NOT NULL;

ALTER TABLE pending_packages ENABLE ROW LEVEL SECURITY;

CREATE POLICY "users_read_own_pending_packages" ON pending_packages
  FOR SELECT USING (auth.uid() = user_id);

CREATE POLICY "admins_manage_pending_packages" ON pending_packages
  FOR ALL USING (public.is_admin());

GRANT SELECT, INSERT, UPDATE, DELETE ON pending_packages TO authenticated;

-- Trigger: bump updated_at
CREATE OR REPLACE FUNCTION public.bump_pending_package_updated_at()
RETURNS TRIGGER LANGUAGE plpgsql AS $$
BEGIN NEW.updated_at = now(); RETURN NEW; END;
$$;

DROP TRIGGER IF EXISTS trg_bump_pending_package_updated_at ON pending_packages;
CREATE TRIGGER trg_bump_pending_package_updated_at
  BEFORE UPDATE ON pending_packages
  FOR EACH ROW EXECUTE FUNCTION public.bump_pending_package_updated_at();

-- ============================================================
-- 3) RPC: admin marca live_purchase como atendida → auto pending_package
-- ============================================================
CREATE OR REPLACE FUNCTION public.mark_purchase_attended(
  p_purchase_id UUID,
  p_note TEXT DEFAULT NULL
)
RETURNS UUID
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
DECLARE
  v_purchase   live_purchases%ROWTYPE;
  v_offer      live_offers%ROWTYPE;
  v_package_id UUID;
BEGIN
  IF NOT public.is_admin() THEN
    RAISE EXCEPTION 'No tenés permisos';
  END IF;

  SELECT * INTO v_purchase FROM live_purchases WHERE id = p_purchase_id FOR UPDATE;
  IF NOT FOUND THEN
    RAISE EXCEPTION 'Compra no encontrada';
  END IF;

  -- Si ya tiene pending_package, devolver el existente (idempotente)
  SELECT id INTO v_package_id FROM pending_packages
   WHERE live_purchase_id = p_purchase_id;
  IF v_package_id IS NOT NULL THEN
    -- Sólo asegurar attended_at en la purchase
    UPDATE live_purchases
       SET attended_at = COALESCE(attended_at, now()),
           attended_by = COALESCE(attended_by, auth.uid()),
           updated_at  = now()
     WHERE id = p_purchase_id;
    RETURN v_package_id;
  END IF;

  SELECT * INTO v_offer FROM live_offers WHERE id = v_purchase.offer_id;

  INSERT INTO pending_packages (
    user_id, live_event_id, live_offer_id, live_purchase_id, order_id,
    description, unit_count, amount, image_url, notes, created_by
  ) VALUES (
    v_purchase.user_id,
    v_purchase.event_id,
    v_purchase.offer_id,
    v_purchase.id,
    v_purchase.order_id,
    COALESCE(v_offer.name, 'Paquete dinámica'),
    COALESCE(v_offer.unit_count, 1),
    v_purchase.amount,
    v_offer.image_url,
    p_note,
    auth.uid()
  )
  RETURNING id INTO v_package_id;

  UPDATE live_purchases
     SET attended_at = now(),
         attended_by = auth.uid(),
         admin_notes = COALESCE(p_note, admin_notes),
         marked_by   = COALESCE(marked_by, auth.uid()),
         updated_at  = now()
   WHERE id = p_purchase_id;

  RETURN v_package_id;
END;
$$;

GRANT EXECUTE ON FUNCTION public.mark_purchase_attended TO authenticated;

-- ============================================================
-- 4) RPC: admin crea pending_package manual (sin live_purchase, p.ej. cash)
-- ============================================================
CREATE OR REPLACE FUNCTION public.create_manual_pending_package(
  p_user_id UUID,
  p_description TEXT,
  p_amount NUMERIC,
  p_unit_count INT DEFAULT 1,
  p_live_event_id UUID DEFAULT NULL,
  p_notes TEXT DEFAULT NULL
)
RETURNS UUID
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
DECLARE
  v_id UUID;
BEGIN
  IF NOT public.is_admin() THEN
    RAISE EXCEPTION 'No tenés permisos';
  END IF;

  INSERT INTO pending_packages (
    user_id, description, amount, unit_count, live_event_id, notes, created_by
  ) VALUES (
    p_user_id, p_description, p_amount, p_unit_count, p_live_event_id, p_notes, auth.uid()
  )
  RETURNING id INTO v_id;

  RETURN v_id;
END;
$$;

GRANT EXECUTE ON FUNCTION public.create_manual_pending_package TO authenticated;

-- ============================================================
-- 5) RPC: admin descarta un pending_package
-- ============================================================
CREATE OR REPLACE FUNCTION public.cancel_pending_package(p_package_id UUID, p_reason TEXT DEFAULT NULL)
RETURNS BOOLEAN
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
BEGIN
  IF NOT public.is_admin() THEN
    RAISE EXCEPTION 'No tenés permisos';
  END IF;

  UPDATE pending_packages
     SET status       = 'cancelled'::pending_package_status,
         cancelled_at = now(),
         notes        = COALESCE(p_reason, notes),
         updated_at   = now()
   WHERE id = p_package_id AND status = 'pending'::pending_package_status;

  RETURN FOUND;
END;
$$;

GRANT EXECUTE ON FUNCTION public.cancel_pending_package TO authenticated;

-- ============================================================
-- 6) RPC: consolidar varios pending_packages en un shipment nuevo (atómico)
-- ============================================================
CREATE OR REPLACE FUNCTION public.consolidate_pending_packages_into_shipment(
  p_user_id        UUID,
  p_package_ids    UUID[],
  p_carrier        shipment_carrier,
  p_description    TEXT,
  p_weight_grams   INT,
  p_length_cm      INT,
  p_width_cm       INT,
  p_height_cm      INT,
  p_declared_value NUMERIC DEFAULT NULL,
  p_internal_notes TEXT DEFAULT NULL
)
RETURNS UUID
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
DECLARE
  v_shipment_id     UUID;
  v_total_value     NUMERIC := 0;
  v_first_event_id  UUID;
  v_count           INT;
  v_full_desc       TEXT;
BEGIN
  IF NOT public.is_admin() THEN
    RAISE EXCEPTION 'No tenés permisos';
  END IF;

  IF p_package_ids IS NULL OR array_length(p_package_ids, 1) IS NULL THEN
    RAISE EXCEPTION 'Tenés que seleccionar al menos un paquete pendiente';
  END IF;

  -- Validar que TODOS los packages pertenecen a este user y están 'pending'
  SELECT COUNT(*) INTO v_count
    FROM pending_packages
   WHERE id = ANY(p_package_ids)
     AND user_id = p_user_id
     AND status = 'pending'::pending_package_status;

  IF v_count <> array_length(p_package_ids, 1) THEN
    RAISE EXCEPTION 'Algún paquete no es de esa clienta o no está disponible';
  END IF;

  -- Total declarado y un live_event_id para el snapshot
  SELECT COALESCE(SUM(amount), 0), MIN(live_event_id)
    INTO v_total_value, v_first_event_id
    FROM pending_packages
   WHERE id = ANY(p_package_ids);

  -- Descripción auto si no se pasa
  IF p_description IS NULL OR length(trim(p_description)) = 0 THEN
    SELECT string_agg(description, ' + ')
      INTO v_full_desc
      FROM pending_packages
     WHERE id = ANY(p_package_ids);
  ELSE
    v_full_desc := p_description;
  END IF;

  -- Crear shipment
  INSERT INTO shipments (
    user_id, live_event_id,
    status, carrier,
    description, weight_grams, length_cm, width_cm, height_cm,
    declared_value, internal_notes, created_by
  ) VALUES (
    p_user_id, v_first_event_id,
    'pending_address'::shipment_status, p_carrier,
    v_full_desc, p_weight_grams, p_length_cm, p_width_cm, p_height_cm,
    COALESCE(p_declared_value, v_total_value), p_internal_notes, auth.uid()
  )
  RETURNING id INTO v_shipment_id;

  -- Marcar todos los packages como shipped
  UPDATE pending_packages
     SET status     = 'shipped'::pending_package_status,
         shipment_id = v_shipment_id,
         shipped_at = now(),
         updated_at = now()
   WHERE id = ANY(p_package_ids);

  RETURN v_shipment_id;
END;
$$;

GRANT EXECUTE ON FUNCTION public.consolidate_pending_packages_into_shipment TO authenticated;

-- ============================================================
-- 7) Vista: pendientes agrupados por clienta (para /admin/shipments/pending)
-- ============================================================
CREATE OR REPLACE VIEW public.pending_packages_by_customer AS
SELECT
  pp.user_id,
  p.full_name,
  p.email,
  p.phone,
  COUNT(*)            AS pending_count,
  COALESCE(SUM(pp.amount), 0) AS pending_total,
  MIN(pp.created_at)  AS oldest_at,
  MAX(pp.created_at)  AS newest_at,
  ARRAY_AGG(pp.id ORDER BY pp.created_at DESC) AS package_ids
FROM pending_packages pp
JOIN profiles p ON p.id = pp.user_id
WHERE pp.status = 'pending'::pending_package_status
GROUP BY pp.user_id, p.full_name, p.email, p.phone;

GRANT SELECT ON public.pending_packages_by_customer TO authenticated;

-- ============================================================
-- 8) Reload schema
-- ============================================================
NOTIFY pgrst, 'reload schema';
