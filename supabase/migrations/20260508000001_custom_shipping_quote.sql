-- ============================================================
-- ENVÍO PERSONALIZADO + FLUJO DEFERRED PARA CHECKOUT DE TIENDA
-- ============================================================
--
-- ⚠️  IMPORTANTE — APLICAR EN 2 RUNS DEL SQL EDITOR
--
-- Postgres no permite usar un valor de enum recién agregado (ALTER TYPE ADD VALUE)
-- dentro de la misma transacción donde se agregó. El SQL Editor de Supabase mete
-- todo el archivo en una transacción implícita, así que si pegás todo de una vez
-- vas a recibir:  22P02: invalid input value for enum
--
-- Hacelo así:
--   1) Pegá y ejecutá SOLO las dos líneas de "ALTER TYPE ... ADD VALUE" de abajo.
--   2) Verificá con:
--        SELECT enumlabel FROM pg_enum WHERE enumtypid = 'shipment_status'::regtype;
--      → tiene que aparecer 'pending_custom_quote'
--   3) Después pegá y ejecutá el resto del archivo (desde "ALTER TABLE shipments").
--
-- Si usás `supabase db push` con CLI, la migration corre contra una conexión
-- separada y no hay problema — esto sólo afecta al SQL Editor del Dashboard.
--
-- Cambios:
--   1) Nuevo carrier 'personalizado' — admin acuerda precio con la clienta
--      (efectivo, transferencia, retiro, motoboy, etc).
--   2) Nuevo status 'pending_custom_quote' para shipments que esperan que
--      admin cargue el precio de envío personalizado.
--   3) Nuevas columnas en shipments para guardar la cotización personalizada
--      y el contacto de la clienta (porque puede no estar logueada al wizard).
--   4) RPC `customer_request_custom_quote` y `admin_set_custom_quote`.

-- ----------------------------------------------------------
-- 1) Carrier 'personalizado'
-- ----------------------------------------------------------
ALTER TYPE shipment_carrier ADD VALUE IF NOT EXISTS 'personalizado';

-- ----------------------------------------------------------
-- 2) Status 'pending_custom_quote'
-- ----------------------------------------------------------
ALTER TYPE shipment_status ADD VALUE IF NOT EXISTS 'pending_custom_quote';

-- ----------------------------------------------------------
-- 3) Columnas nuevas en shipments
-- ----------------------------------------------------------
ALTER TABLE shipments
  ADD COLUMN IF NOT EXISTS custom_quote_amount NUMERIC(10,2),
  ADD COLUMN IF NOT EXISTS custom_quote_message TEXT,
  ADD COLUMN IF NOT EXISTS custom_quoted_at TIMESTAMPTZ,
  ADD COLUMN IF NOT EXISTS custom_quoted_by UUID REFERENCES profiles(id) ON DELETE SET NULL,
  -- Contacto del comprador para mandarle el link sin que esté logueado en otro device
  ADD COLUMN IF NOT EXISTS contact_email TEXT,
  ADD COLUMN IF NOT EXISTS contact_phone TEXT,
  -- Marca de "le mandamos el link después del checkout"
  ADD COLUMN IF NOT EXISTS link_sent_at TIMESTAMPTZ;

CREATE INDEX IF NOT EXISTS idx_shipments_custom_quote_pending
  ON shipments(created_at DESC)
  WHERE status = 'pending_custom_quote'::shipment_status;

-- ----------------------------------------------------------
-- 4) RPC: clienta pide cotización personalizada
-- ----------------------------------------------------------
-- La clienta entra al wizard y elige "Personalizado". Esto:
--   - Cambia carrier a 'personalizado'
--   - Cambia status a 'pending_custom_quote'
--   - Limpia cualquier cotización vieja
-- Después admin llena el precio.
CREATE OR REPLACE FUNCTION public.customer_request_custom_quote(
  p_shipment_id UUID,
  p_destination_address JSONB,
  p_message TEXT DEFAULT NULL
) RETURNS VOID
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_user_id UUID;
BEGIN
  SELECT user_id INTO v_user_id FROM shipments WHERE id = p_shipment_id;
  IF v_user_id IS NULL THEN
    RAISE EXCEPTION 'Shipment no encontrado';
  END IF;

  -- Sólo el dueño puede pedir custom quote, y sólo si está pending_address o pending_payment
  IF v_user_id <> auth.uid() AND NOT public.is_admin() THEN
    RAISE EXCEPTION 'No tenés permiso';
  END IF;

  UPDATE shipments
  SET carrier               = 'personalizado'::shipment_carrier,
      status                = 'pending_custom_quote'::shipment_status,
      destination_address   = COALESCE(p_destination_address, destination_address),
      destination_type      = COALESCE(destination_type, 'domicilio'::shipment_destination_type),
      custom_quote_amount   = NULL,
      custom_quote_message  = p_message,
      custom_quoted_at      = NULL,
      custom_quoted_by      = NULL,
      cost_quoted           = NULL,
      cost_charged          = NULL,
      mp_preference_id      = NULL,
      updated_at            = now()
  WHERE id = p_shipment_id
    AND status IN ('pending_address'::shipment_status, 'pending_payment'::shipment_status, 'pending_custom_quote'::shipment_status);
END;
$$;

GRANT EXECUTE ON FUNCTION public.customer_request_custom_quote TO authenticated;

-- ----------------------------------------------------------
-- 5) RPC: admin pone el precio personalizado
-- ----------------------------------------------------------
CREATE OR REPLACE FUNCTION public.admin_set_custom_quote(
  p_shipment_id UUID,
  p_amount NUMERIC,
  p_message TEXT DEFAULT NULL
) RETURNS VOID
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  IF NOT public.is_admin() THEN
    RAISE EXCEPTION 'Solo admin';
  END IF;
  IF p_amount IS NULL OR p_amount < 0 THEN
    RAISE EXCEPTION 'Monto inválido';
  END IF;

  UPDATE shipments
  SET custom_quote_amount  = p_amount,
      custom_quote_message = p_message,
      custom_quoted_at     = now(),
      custom_quoted_by     = auth.uid(),
      cost_quoted          = p_amount,
      cost_charged         = p_amount,
      status               = 'pending_payment'::shipment_status,
      updated_at           = now()
  WHERE id = p_shipment_id
    AND carrier = 'personalizado'::shipment_carrier
    AND status = 'pending_custom_quote'::shipment_status;
  IF NOT FOUND THEN
    RAISE EXCEPTION 'Shipment no encontrado o no está esperando cotización';
  END IF;
END;
$$;

GRANT EXECUTE ON FUNCTION public.admin_set_custom_quote TO authenticated;

-- ----------------------------------------------------------
-- 6) RLS: la clienta puede UPDATE shipments en pending_custom_quote
--    (porque admin cambió el monto y la clienta vuelve al wizard)
-- ----------------------------------------------------------
DROP POLICY IF EXISTS "users_update_own_pending_custom" ON shipments;
CREATE POLICY "users_update_own_pending_custom" ON shipments
  FOR UPDATE
  USING (user_id = auth.uid() AND status IN (
    'pending_address'::shipment_status,
    'pending_custom_quote'::shipment_status,
    'pending_payment'::shipment_status
  ));

-- ----------------------------------------------------------
-- 7) Reload schema cache
-- ----------------------------------------------------------
NOTIFY pgrst, 'reload schema';
