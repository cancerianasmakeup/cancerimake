-- ============================================================
-- Settings adicionales: brand_info, analytics, seo, maintenance,
-- free shipping threshold y descuento por transferencia.
-- ============================================================

-- Marca / identidad — leído por Header, Footer, /auth, layout (metadata).
INSERT INTO site_settings (key, value) VALUES (
  'brand_info',
  jsonb_build_object(
    'name', 'Cancerianas',
    'tagline', 'Para mujeres libres',
    'logo_url', 'https://pub-4cc128b92e8340509487ec06143abf2e.r2.dev/cancerianas/LOGO%20HOR%202.png',
    'whatsapp', '',
    'whatsapp_default_message', '¡Hola! Tengo una consulta sobre la tienda.',
    'instagram_url', 'https://instagram.com',
    'tiktok_url', 'https://tiktok.com',
    'contact_email', 'cancerianas.kids@gmail.com',
    'show_whatsapp_floating', true,
    'show_instagram', true,
    'show_tiktok', true
  )
) ON CONFLICT (key) DO NOTHING;

-- Analytics — leído por layout.tsx (inyecta tags si están configurados).
INSERT INTO site_settings (key, value) VALUES (
  'analytics',
  jsonb_build_object(
    'ga4_id', '',
    'fb_pixel_id', '',
    'tiktok_pixel_id', ''
  )
) ON CONFLICT (key) DO NOTHING;

-- SEO — overrides del metadata default.
INSERT INTO site_settings (key, value) VALUES (
  'seo',
  jsonb_build_object(
    'meta_title', '',
    'meta_description', '',
    'og_image_url', '',
    'keywords', ''
  )
) ON CONFLICT (key) DO NOTHING;

-- Modo mantenimiento — leído por un layout que tapa el sitio cuando enabled=true.
INSERT INTO site_settings (key, value) VALUES (
  'maintenance',
  jsonb_build_object(
    'enabled', false,
    'message', 'Volvemos en un toque 🌸. Estamos haciendo mejoras en la tienda.',
    'allow_admins', true
  )
) ON CONFLICT (key) DO NOTHING;

-- Apariencia básica (color principal — usado por una CSS variable global).
INSERT INTO site_settings (key, value) VALUES (
  'appearance',
  jsonb_build_object(
    'primary_color', '#D44E7C',
    'show_announcement_bar', false,
    'announcement_text', '',
    'announcement_link', ''
  )
) ON CONFLICT (key) DO NOTHING;

-- Extender shipping_extras con free_shipping_threshold sin pisar valores existentes.
UPDATE site_settings
SET value = value
  || jsonb_build_object('free_shipping_threshold', COALESCE(value->>'free_shipping_threshold', '0')::numeric)
WHERE key = 'shipping_extras'
  AND NOT (value ? 'free_shipping_threshold');

-- Extender payment_methods con campos nuevos sin pisar.
UPDATE site_settings
SET value = value
  || jsonb_build_object(
       'transfer_discount_pct', COALESCE(value->>'transfer_discount_pct', '0')::numeric,
       'mercadopago_installments_text', COALESCE(value->>'mercadopago_installments_text', 'Hasta 12 cuotas sin interés')
     )
WHERE key = 'payment_methods'
  AND (NOT (value ? 'transfer_discount_pct') OR NOT (value ? 'mercadopago_installments_text'));
