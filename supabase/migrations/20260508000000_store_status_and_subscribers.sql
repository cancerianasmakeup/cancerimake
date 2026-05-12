-- ============================================================
-- STORE STATUS — Tienda de oportunidades con drops puntuales
-- ============================================================
-- Modelo:
--   site_settings.store_status (JSONB) controla apertura/cierre.
--   store_subscribers guarda contactos (email/whatsapp) para avisar
--   cuando abre el próximo drop.

-- Default config para store_status: cerrada, sin drops, con mensajes base
INSERT INTO site_settings (key, value) VALUES (
  'store_status',
  jsonb_build_object(
    'force_state', 'auto',                -- 'auto' | 'open' | 'closed'  (override admin)
    'force_until', null,                  -- ISO timestamp opcional para "abrir hasta tal hora"
    'drops', '[]'::jsonb,                 -- [{ id, starts_at, ends_at, label }]
    'closed_title', 'Volvemos pronto',
    'closed_message', 'Cerramos para preparar el próximo drop con ofertas exclusivas.',
    'closed_subtitle', 'Te avisamos cuando abrimos. Mientras tanto seguinos en TikTok.',
    'open_banner_text', '⚡ TIENDA ABIERTA · ofertas exclusivas por tiempo limitado',
    'tiktok_url', 'https://www.tiktok.com/@cancerianas.makeup2',
    'instagram_url', '',
    'timezone', 'America/Argentina/Buenos_Aires'
  )
) ON CONFLICT (key) DO NOTHING;

-- ============================================================
-- STORE SUBSCRIBERS (lista de "avisame cuando abra")
-- ============================================================
CREATE TABLE IF NOT EXISTS store_subscribers (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  email TEXT,
  phone TEXT,                              -- en formato internacional sugerido (+54911...)
  source TEXT DEFAULT 'landing_closed',
  notified_drops UUID[] DEFAULT '{}',      -- track de qué drops ya recibió aviso
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  CONSTRAINT subscriber_has_contact CHECK (email IS NOT NULL OR phone IS NOT NULL)
);

-- Evitar duplicados por mismo email o mismo phone (case-insensitive en email)
CREATE UNIQUE INDEX IF NOT EXISTS store_subscribers_email_unique
  ON store_subscribers (lower(email)) WHERE email IS NOT NULL;
CREATE UNIQUE INDEX IF NOT EXISTS store_subscribers_phone_unique
  ON store_subscribers (phone) WHERE phone IS NOT NULL;
CREATE INDEX IF NOT EXISTS store_subscribers_created_at_idx
  ON store_subscribers (created_at DESC);

ALTER TABLE store_subscribers ENABLE ROW LEVEL SECURITY;

-- Cualquiera puede suscribirse (anónimos también, vienen desde TikTok sin cuenta)
DROP POLICY IF EXISTS "anyone_can_subscribe" ON store_subscribers;
CREATE POLICY "anyone_can_subscribe" ON store_subscribers
  FOR INSERT WITH CHECK (true);

-- Sólo admins leen / borran / modifican
DROP POLICY IF EXISTS "admins_read_subscribers" ON store_subscribers;
CREATE POLICY "admins_read_subscribers" ON store_subscribers
  FOR SELECT USING (public.is_admin());

DROP POLICY IF EXISTS "admins_modify_subscribers" ON store_subscribers;
CREATE POLICY "admins_modify_subscribers" ON store_subscribers
  FOR UPDATE USING (public.is_admin());

DROP POLICY IF EXISTS "admins_delete_subscribers" ON store_subscribers;
CREATE POLICY "admins_delete_subscribers" ON store_subscribers
  FOR DELETE USING (public.is_admin());

-- Grants para roles anon y authenticated (según patrón del repo en migration 003)
GRANT INSERT ON store_subscribers TO anon, authenticated;
GRANT SELECT, UPDATE, DELETE ON store_subscribers TO authenticated;
