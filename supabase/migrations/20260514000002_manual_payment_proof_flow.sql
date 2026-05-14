-- ============================================================
-- Flujo manual de pagos con comprobante (orden + envío).
--
-- Para tiendas chicas que aún no integran APIs de pagos automáticos:
-- el cliente paga via transferencia / método personalizado, sube el
-- comprobante (o marca "envié por WhatsApp"), y un admin aprueba
-- manualmente antes de que avance la orden o el shipment.
--
-- Mismo patrón para el envío: el cliente paga el envío después de
-- llenar el formulario, sube el comprobante, admin aprueba, admin
-- marca como ENVIADO con número de seguimiento.
-- ============================================================

-- ---------- ENUM: order_status: agregar pending_approval --------
DO $$ BEGIN
  ALTER TYPE order_status ADD VALUE IF NOT EXISTS 'pending_approval' BEFORE 'paid';
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

-- ---------- ENUM: shipment_status: agregar pending_quote + pending_approval --------
DO $$ BEGIN
  ALTER TYPE shipment_status ADD VALUE IF NOT EXISTS 'pending_quote'    BEFORE 'pending_payment';
EXCEPTION WHEN duplicate_object THEN NULL; END $$;
DO $$ BEGIN
  ALTER TYPE shipment_status ADD VALUE IF NOT EXISTS 'pending_approval' BEFORE 'paid';
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

-- ---------- ORDERS: payment proof fields ----------
ALTER TABLE public.orders
  ADD COLUMN IF NOT EXISTS payment_proof_url           TEXT,
  ADD COLUMN IF NOT EXISTS payment_proof_via_whatsapp  BOOLEAN NOT NULL DEFAULT false,
  ADD COLUMN IF NOT EXISTS payment_proof_note          TEXT,
  ADD COLUMN IF NOT EXISTS payment_proof_at            TIMESTAMPTZ,
  ADD COLUMN IF NOT EXISTS payment_approved_at         TIMESTAMPTZ,
  ADD COLUMN IF NOT EXISTS payment_approved_by         UUID REFERENCES public.profiles(id) ON DELETE SET NULL,
  ADD COLUMN IF NOT EXISTS wants_shipping              BOOLEAN NOT NULL DEFAULT true,
  ADD COLUMN IF NOT EXISTS destination_type_requested  shipment_destination_type;

-- ---------- SHIPMENTS: payment proof fields + tracking genérico ----------
ALTER TABLE public.shipments
  ADD COLUMN IF NOT EXISTS payment_proof_url           TEXT,
  ADD COLUMN IF NOT EXISTS payment_proof_via_whatsapp  BOOLEAN NOT NULL DEFAULT false,
  ADD COLUMN IF NOT EXISTS payment_proof_note          TEXT,
  ADD COLUMN IF NOT EXISTS payment_proof_at            TIMESTAMPTZ,
  ADD COLUMN IF NOT EXISTS payment_approved_at         TIMESTAMPTZ,
  ADD COLUMN IF NOT EXISTS payment_approved_by         UUID REFERENCES public.profiles(id) ON DELETE SET NULL,
  ADD COLUMN IF NOT EXISTS tracking_number             TEXT,
  ADD COLUMN IF NOT EXISTS tracking_provider           TEXT,
  ADD COLUMN IF NOT EXISTS tracking_url                TEXT;

-- Update RLS para permitir que el cliente actualice su orden para subir comprobante
-- mientras siga en estados previos a 'paid'.
DROP POLICY IF EXISTS "users_update_own_order_proof" ON public.orders;
CREATE POLICY "users_update_own_order_proof" ON public.orders
  FOR UPDATE
  USING (auth.uid() = user_id AND status IN ('pending', 'pending_approval'))
  WITH CHECK (auth.uid() = user_id);

-- Mismo para shipments cuando el cliente sube el comprobante de envío
DROP POLICY IF EXISTS "users_update_own_shipment_proof" ON public.shipments;
CREATE POLICY "users_update_own_shipment_proof" ON public.shipments
  FOR UPDATE
  USING (auth.uid() = user_id AND status IN ('pending_payment', 'pending_approval'))
  WITH CHECK (auth.uid() = user_id);

-- ============================================================
-- STORAGE BUCKET: payment-proofs (privado)
-- ============================================================
INSERT INTO storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
VALUES (
  'payment-proofs',
  'payment-proofs',
  false,
  10 * 1024 * 1024,  -- 10 MB max
  ARRAY['image/jpeg', 'image/png', 'image/webp', 'application/pdf']
)
ON CONFLICT (id) DO UPDATE SET
  public = EXCLUDED.public,
  file_size_limit = EXCLUDED.file_size_limit,
  allowed_mime_types = EXCLUDED.allowed_mime_types;

-- RLS de objects: clientes suben a su propia carpeta, admins leen todo.
-- Estructura de path: <type>/<owner_user_id>/<id>/<filename>
-- Ej: orders/<user_id>/<order_id>/comprobante.jpg
--     shipments/<user_id>/<shipment_id>/comprobante.jpg

DROP POLICY IF EXISTS "payment_proofs_users_insert_own" ON storage.objects;
CREATE POLICY "payment_proofs_users_insert_own" ON storage.objects
  FOR INSERT TO authenticated
  WITH CHECK (
    bucket_id = 'payment-proofs'
    AND (storage.foldername(name))[1] IN ('orders', 'shipments')
    AND (storage.foldername(name))[2] = auth.uid()::text
  );

DROP POLICY IF EXISTS "payment_proofs_users_select_own" ON storage.objects;
CREATE POLICY "payment_proofs_users_select_own" ON storage.objects
  FOR SELECT TO authenticated
  USING (
    bucket_id = 'payment-proofs'
    AND (
      (storage.foldername(name))[2] = auth.uid()::text
      OR public.is_admin()
    )
  );

DROP POLICY IF EXISTS "payment_proofs_admins_all" ON storage.objects;
CREATE POLICY "payment_proofs_admins_all" ON storage.objects
  FOR ALL TO authenticated
  USING (bucket_id = 'payment-proofs' AND public.is_admin())
  WITH CHECK (bucket_id = 'payment-proofs' AND public.is_admin());
