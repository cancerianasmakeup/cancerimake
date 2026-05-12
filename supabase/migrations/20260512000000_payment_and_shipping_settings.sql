-- ============================================================
-- PAYMENT METHODS & SHIPPING METHODS settings
-- ============================================================

-- Métodos de pago disponibles en la tienda
INSERT INTO site_settings (key, value) VALUES (
  'payment_methods',
  jsonb_build_object(
    'mercadopago_enabled', false,
    'mercadopago_access_token', '',
    'mercadopago_public_key', '',
    'transfer_enabled', true,
    'transfer_alias', '',
    'transfer_bank', '',
    'transfer_cbu', '',
    'transfer_holder', ''
  )
) ON CONFLICT (key) DO UPDATE SET value = EXCLUDED.value;

-- Métodos de envío habilitados en la tienda
INSERT INTO site_settings (key, value) VALUES (
  'shipping_methods',
  jsonb_build_object(
    'andreani_enabled', true,
    'correo_argentino_enabled', false,
    'custom_enabled', false,
    'custom_label', 'Envío personalizado',
    'custom_price', 0
  )
) ON CONFLICT (key) DO UPDATE SET value = EXCLUDED.value;

-- Agregar columna payment_method a orders si no existe
ALTER TABLE orders ADD COLUMN IF NOT EXISTS payment_method TEXT DEFAULT 'mercadopago';

-- Agregar columna paid_at a orders si no existe
ALTER TABLE orders ADD COLUMN IF NOT EXISTS paid_at TIMESTAMPTZ;
