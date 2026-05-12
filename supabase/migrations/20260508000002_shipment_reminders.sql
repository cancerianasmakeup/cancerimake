-- ============================================================
-- RECORDATORIOS DE ENVÍO PENDIENTE
-- ============================================================
--
-- ⚠️ Esta migration depende del enum value 'pending_custom_quote' agregado en
-- 20260508000001_custom_shipping_quote.sql. Si esa migration no se aplicó,
-- el CREATE INDEX de abajo falla con "22P02: invalid input value for enum".
--
-- Cuando una clienta paga productos pero no completa el envío (no carga
-- dirección, no elige carrier, no paga la cotización custom), le mandamos
-- recordatorios:
--   · 1er recordatorio: 24hs desde link_sent_at (o desde la cotización custom)
--   · 2do recordatorio: 72hs desde link_sent_at
--   · No se elimina ni reembolsa: el producto queda reservado hasta que pague.

ALTER TABLE shipments
  ADD COLUMN IF NOT EXISTS reminder_count INTEGER NOT NULL DEFAULT 0,
  ADD COLUMN IF NOT EXISTS last_reminder_at TIMESTAMPTZ;

-- Index para que el cron encuentre rápido los que tocan recordar
CREATE INDEX IF NOT EXISTS idx_shipments_pending_reminders
  ON shipments(status, last_reminder_at NULLS FIRST, reminder_count)
  WHERE status IN (
    'pending_address'::shipment_status,
    'pending_custom_quote'::shipment_status,
    'pending_payment'::shipment_status
  );

NOTIFY pgrst, 'reload schema';
