-- ============================================================
-- ENVÍOS (Andreani como carrier principal)
-- ============================================================
-- Flujo:
-- 1. Admin crea shipment para una clienta (peso, dimensiones, descripción) → status = 'pending_address'
-- 2. Clienta llena dirección + paga via MP → status = 'paid'
-- 3. Admin (o automático) llama Andreani API → genera tracking + etiqueta → status = 'label_generated'
-- 4. Admin imprime y despacha → status = 'dispatched'
-- 5. Andreani actualiza tracking via cron → status sigue: in_transit → out_for_delivery → delivered

-- ============================================================
-- ENUMS
-- ============================================================
DO $$ BEGIN
  CREATE TYPE shipment_status AS ENUM (
    'pending_address',  -- admin lo creó, esperando que clienta llene dirección
    'pending_payment',  -- dirección lista, esperando pago
    'paid',             -- pagado, listo para generar etiqueta
    'label_generated',  -- etiqueta de Andreani lista, esperando despacho
    'dispatched',       -- despachado por Cancerianas
    'in_transit',       -- Andreani lo tiene en tránsito
    'out_for_delivery', -- en distribución hoy
    'delivered',        -- entregado
    'returned',         -- volvió al remitente
    'failed',           -- falló entrega definitivamente
    'cancelled'         -- cancelado
  );
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

DO $$ BEGIN
  CREATE TYPE shipment_destination_type AS ENUM ('domicilio', 'sucursal');
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

DO $$ BEGIN
  CREATE TYPE shipment_carrier AS ENUM ('andreani');
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

-- ============================================================
-- SITE SETTINGS (config global, key/value)
-- ============================================================
CREATE TABLE IF NOT EXISTS site_settings (
  key TEXT PRIMARY KEY,
  value JSONB NOT NULL,
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_by UUID REFERENCES profiles(id) ON DELETE SET NULL
);

ALTER TABLE site_settings ENABLE ROW LEVEL SECURITY;

-- Lectura: pública (la dirección de origen es pública en una etiqueta de envío)
CREATE POLICY "public_reads_settings" ON site_settings
  FOR SELECT USING (true);

CREATE POLICY "admins_manage_settings" ON site_settings
  FOR ALL USING (public.is_admin());

-- Defaults
INSERT INTO site_settings (key, value) VALUES
  ('shipping_origin', jsonb_build_object(
    'nombre_comercial', 'Cancerianas',
    'razon_social', 'Cancerianas',
    'cuit', '',
    'codigo_postal', '1744',
    'calle', 'Moreno',
    'numero', '',
    'piso', '',
    'depto', '',
    'localidad', 'Moreno',
    'region', 'Buenos Aires',
    'telefono', '',
    'email', 'cancerianas.kids@gmail.com'
  )),
  ('andreani_status', jsonb_build_object(
    'mode', 'mock',
    'last_test', null
  )),
  ('shipping_extras', jsonb_build_object(
    'recargo_porcentaje', 0,
    'fee_fijo', 0,
    'note_for_customer', 'Te llega con Andreani en 24-72hs según zona.'
  ))
ON CONFLICT (key) DO NOTHING;

-- ============================================================
-- SHIPMENTS (envíos)
-- ============================================================
CREATE TABLE IF NOT EXISTS shipments (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),

  -- A quién se le envía
  user_id UUID NOT NULL REFERENCES profiles(id) ON DELETE RESTRICT,

  -- Vínculos opcionales
  order_id UUID REFERENCES orders(id) ON DELETE SET NULL,
  live_event_id UUID REFERENCES live_events(id) ON DELETE SET NULL,

  -- Status & carrier
  status shipment_status NOT NULL DEFAULT 'pending_address',
  carrier shipment_carrier NOT NULL DEFAULT 'andreani',

  -- Datos del paquete (los carga el admin)
  description TEXT NOT NULL,           -- "Set Pétalos + cosmética"
  weight_grams INTEGER NOT NULL,       -- gramos para precisión
  length_cm INTEGER,
  width_cm INTEGER,
  height_cm INTEGER,
  declared_value NUMERIC(10,2) NOT NULL DEFAULT 0,
  internal_notes TEXT,                 -- notas del admin (no las ve la clienta)

  -- Cómo y a dónde se entrega (lo carga la clienta)
  destination_type shipment_destination_type,
  destination_address JSONB,           -- snapshot de la dirección al momento de pagar
  destination_branch JSONB,            -- snapshot de la sucursal Andreani si eligió sucursal

  -- Cobro al cliente
  cost_quoted NUMERIC(10,2),           -- lo que cotizó Andreani al armar
  cost_charged NUMERIC(10,2),          -- lo que efectivamente cobramos (puede tener recargo)
  mp_preference_id TEXT,
  mp_payment_id TEXT,
  paid_at TIMESTAMPTZ,

  -- Andreani response
  andreani_tracking_number TEXT,
  andreani_remito TEXT,
  andreani_label_url TEXT,             -- URL del PDF de la etiqueta
  andreani_estimated_delivery DATE,
  andreani_response JSONB,             -- payload completo para auditoría
  andreani_last_status TEXT,           -- último estado leído de Andreani
  andreani_last_polled_at TIMESTAMPTZ,

  -- Timestamps
  created_by UUID REFERENCES profiles(id) ON DELETE SET NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  dispatched_at TIMESTAMPTZ,
  delivered_at TIMESTAMPTZ
);

CREATE INDEX IF NOT EXISTS idx_shipments_user ON shipments(user_id, status);
CREATE INDEX IF NOT EXISTS idx_shipments_status ON shipments(status, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_shipments_tracking ON shipments(andreani_tracking_number) WHERE andreani_tracking_number IS NOT NULL;
CREATE INDEX IF NOT EXISTS idx_shipments_pending_poll ON shipments(andreani_last_polled_at)
  WHERE status IN ('dispatched', 'in_transit', 'out_for_delivery');

ALTER TABLE shipments ENABLE ROW LEVEL SECURITY;

CREATE POLICY "users_read_own_shipments" ON shipments
  FOR SELECT USING (auth.uid() = user_id);

CREATE POLICY "users_update_own_pending_address" ON shipments
  FOR UPDATE USING (auth.uid() = user_id AND status = 'pending_address')
  WITH CHECK (auth.uid() = user_id);

CREATE POLICY "admins_manage_shipments" ON shipments
  FOR ALL USING (public.is_admin());

-- ============================================================
-- SHIPMENT EVENTS (timeline / log de cambios)
-- ============================================================
CREATE TABLE IF NOT EXISTS shipment_events (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  shipment_id UUID NOT NULL REFERENCES shipments(id) ON DELETE CASCADE,
  status shipment_status NOT NULL,
  source TEXT NOT NULL,                -- 'admin', 'customer', 'andreani', 'system'
  message TEXT,
  payload JSONB,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  created_by UUID REFERENCES profiles(id) ON DELETE SET NULL
);

CREATE INDEX IF NOT EXISTS idx_shipment_events_shipment ON shipment_events(shipment_id, created_at DESC);

ALTER TABLE shipment_events ENABLE ROW LEVEL SECURITY;

CREATE POLICY "users_read_own_shipment_events" ON shipment_events
  FOR SELECT USING (
    EXISTS (SELECT 1 FROM shipments s WHERE s.id = shipment_id AND s.user_id = auth.uid())
  );

CREATE POLICY "admins_manage_shipment_events" ON shipment_events
  FOR ALL USING (public.is_admin());

-- ============================================================
-- TRIGGER: log automático de cambios de status
-- ============================================================
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

  IF NEW.status IS DISTINCT FROM OLD.status THEN
    INSERT INTO shipment_events (shipment_id, status, source, message)
    VALUES (NEW.id, NEW.status, 'system', 'Cambio automático de estado');
  END IF;

  NEW.updated_at = now();
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_log_shipment_status ON shipments;
CREATE TRIGGER trg_log_shipment_status
  BEFORE INSERT OR UPDATE ON shipments
  FOR EACH ROW EXECUTE FUNCTION public.log_shipment_status_change();

-- ============================================================
-- RPC: customer completa dirección y avanza a pending_payment
-- ============================================================
CREATE OR REPLACE FUNCTION public.customer_set_shipment_address(
  p_shipment_id UUID,
  p_destination_type shipment_destination_type,
  p_destination_address JSONB,
  p_destination_branch JSONB,
  p_cost_quoted NUMERIC,
  p_cost_charged NUMERIC
)
RETURNS BOOLEAN
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
DECLARE
  v_user_id UUID;
BEGIN
  SELECT user_id INTO v_user_id FROM shipments WHERE id = p_shipment_id;
  IF v_user_id IS NULL THEN
    RAISE EXCEPTION 'Envío no encontrado';
  END IF;
  IF v_user_id <> auth.uid() AND NOT public.is_admin() THEN
    RAISE EXCEPTION 'No tenés permisos';
  END IF;

  UPDATE shipments
  SET destination_type = p_destination_type,
      destination_address = p_destination_address,
      destination_branch = p_destination_branch,
      cost_quoted = p_cost_quoted,
      cost_charged = p_cost_charged,
      status = 'pending_payment'::shipment_status,
      updated_at = now()
  WHERE id = p_shipment_id AND status = 'pending_address'::shipment_status;

  RETURN FOUND;
END;
$$;

GRANT EXECUTE ON FUNCTION public.customer_set_shipment_address TO authenticated;

-- ============================================================
-- RPC: marcar shipment como pagado (la llama el webhook MP)
-- ============================================================
CREATE OR REPLACE FUNCTION public.mark_shipment_paid(
  p_shipment_id UUID,
  p_mp_payment_id TEXT
)
RETURNS BOOLEAN
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
BEGIN
  UPDATE shipments
  SET status = 'paid'::shipment_status,
      mp_payment_id = p_mp_payment_id,
      paid_at = now(),
      updated_at = now()
  WHERE id = p_shipment_id AND status = 'pending_payment'::shipment_status;

  RETURN FOUND;
END;
$$;

NOTIFY pgrst, 'reload schema';
