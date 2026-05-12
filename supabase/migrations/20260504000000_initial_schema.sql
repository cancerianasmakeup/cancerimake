-- ============================================================
-- CANCERIANAS - SCHEMA COMPLETO
-- Para ejecutar en Supabase SQL Editor
-- ============================================================

-- Extensiones
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";
CREATE EXTENSION IF NOT EXISTS pg_trgm;

-- ============================================================
-- ENUMS
-- ============================================================
CREATE TYPE user_role AS ENUM ('customer', 'admin');
CREATE TYPE product_status AS ENUM ('active', 'draft', 'archived');
CREATE TYPE order_status AS ENUM ('pending', 'paid', 'preparing', 'shipped', 'delivered', 'cancelled');
CREATE TYPE order_source AS ENUM ('catalog', 'live');
CREATE TYPE live_event_type AS ENUM ('capsulas', 'sobres', 'bolsitas');
CREATE TYPE live_event_status AS ENUM ('draft', 'active', 'paused', 'finished');
CREATE TYPE live_purchase_status AS ENUM ('queued', 'paying', 'paid', 'expired', 'cancelled');

-- ============================================================
-- TABLA: profiles (extiende auth.users de Supabase)
-- ============================================================
CREATE TABLE profiles (
  id UUID PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
  email TEXT NOT NULL,
  full_name TEXT,
  phone TEXT,
  role user_role NOT NULL DEFAULT 'customer',
  mp_customer_id TEXT,
  avatar_url TEXT,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX idx_profiles_role ON profiles(role);

-- Trigger: cuando se crea un usuario en auth.users, crea su profile
CREATE OR REPLACE FUNCTION handle_new_user()
RETURNS TRIGGER AS $$
BEGIN
  INSERT INTO profiles (id, email, full_name)
  VALUES (NEW.id, NEW.email, COALESCE(NEW.raw_user_meta_data->>'full_name', ''));
  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

CREATE TRIGGER on_auth_user_created
  AFTER INSERT ON auth.users
  FOR EACH ROW EXECUTE FUNCTION handle_new_user();

-- ============================================================
-- TABLA: addresses
-- ============================================================
CREATE TABLE addresses (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  user_id UUID NOT NULL REFERENCES profiles(id) ON DELETE CASCADE,
  full_name TEXT NOT NULL,
  street TEXT NOT NULL,
  street_number TEXT,
  apartment TEXT,
  city TEXT NOT NULL,
  province TEXT NOT NULL,
  zip_code TEXT NOT NULL,
  phone TEXT,
  is_default BOOLEAN DEFAULT FALSE,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX idx_addresses_user ON addresses(user_id);

-- ============================================================
-- TABLA: categories
-- ============================================================
CREATE TABLE categories (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  name TEXT NOT NULL,
  slug TEXT UNIQUE NOT NULL,
  parent_id UUID REFERENCES categories(id) ON DELETE SET NULL,
  image_url TEXT,
  display_order INT DEFAULT 0,
  is_active BOOLEAN DEFAULT TRUE,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX idx_categories_parent ON categories(parent_id);
CREATE INDEX idx_categories_slug ON categories(slug);

-- ============================================================
-- TABLA: products
-- ============================================================
CREATE TABLE products (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  name TEXT NOT NULL,
  slug TEXT UNIQUE NOT NULL,
  description TEXT,
  category_id UUID REFERENCES categories(id) ON DELETE SET NULL,
  price NUMERIC(10,2) NOT NULL CHECK (price >= 0),
  compare_price NUMERIC(10,2) CHECK (compare_price IS NULL OR compare_price >= price),
  stock INT NOT NULL DEFAULT 0 CHECK (stock >= 0),
  sku TEXT UNIQUE,
  images TEXT[] DEFAULT ARRAY[]::TEXT[],
  status product_status NOT NULL DEFAULT 'draft',
  is_featured BOOLEAN DEFAULT FALSE,
  weight_grams INT,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX idx_products_category ON products(category_id) WHERE status='active';
CREATE INDEX idx_products_status ON products(status);
CREATE INDEX idx_products_featured ON products(is_featured) WHERE status='active';
CREATE INDEX idx_products_search ON products USING gin(to_tsvector('spanish', name || ' ' || COALESCE(description, '')));

-- ============================================================
-- TABLA: product_variants
-- ============================================================
CREATE TABLE product_variants (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  product_id UUID NOT NULL REFERENCES products(id) ON DELETE CASCADE,
  name TEXT NOT NULL,
  attributes JSONB DEFAULT '{}'::JSONB,
  price_diff NUMERIC(10,2) DEFAULT 0,
  stock INT NOT NULL DEFAULT 0,
  sku TEXT,
  image_url TEXT,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX idx_variants_product ON product_variants(product_id);

-- ============================================================
-- TABLA: carts
-- ============================================================
CREATE TABLE carts (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  user_id UUID NOT NULL REFERENCES profiles(id) ON DELETE CASCADE,
  status TEXT NOT NULL DEFAULT 'active',
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX idx_carts_user ON carts(user_id) WHERE status='active';

-- ============================================================
-- TABLA: cart_items
-- ============================================================
CREATE TABLE cart_items (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  cart_id UUID NOT NULL REFERENCES carts(id) ON DELETE CASCADE,
  product_id UUID NOT NULL REFERENCES products(id) ON DELETE CASCADE,
  variant_id UUID REFERENCES product_variants(id) ON DELETE SET NULL,
  quantity INT NOT NULL DEFAULT 1 CHECK (quantity > 0),
  unit_price NUMERIC(10,2) NOT NULL,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  UNIQUE(cart_id, product_id, variant_id)
);

CREATE INDEX idx_cart_items_cart ON cart_items(cart_id);

-- ============================================================
-- TABLA: orders
-- ============================================================
CREATE SEQUENCE order_number_seq START 1000;

CREATE TABLE orders (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  user_id UUID NOT NULL REFERENCES profiles(id),
  order_number TEXT UNIQUE NOT NULL DEFAULT ('CAN-' || LPAD(NEXTVAL('order_number_seq')::TEXT, 6, '0')),
  status order_status NOT NULL DEFAULT 'pending',
  source order_source NOT NULL DEFAULT 'catalog',
  subtotal NUMERIC(10,2) NOT NULL DEFAULT 0,
  shipping_cost NUMERIC(10,2) NOT NULL DEFAULT 0,
  total NUMERIC(10,2) NOT NULL,
  shipping_address JSONB,
  notes TEXT,
  mp_payment_id TEXT,
  mp_preference_id TEXT,
  mp_status TEXT,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  paid_at TIMESTAMPTZ,
  shipped_at TIMESTAMPTZ,
  delivered_at TIMESTAMPTZ
);

CREATE INDEX idx_orders_user ON orders(user_id, created_at DESC);
CREATE INDEX idx_orders_status ON orders(status);
CREATE INDEX idx_orders_mp_payment ON orders(mp_payment_id);

-- ============================================================
-- TABLA: order_items
-- ============================================================
CREATE TABLE order_items (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  order_id UUID NOT NULL REFERENCES orders(id) ON DELETE CASCADE,
  product_id UUID REFERENCES products(id) ON DELETE SET NULL,
  variant_id UUID REFERENCES product_variants(id) ON DELETE SET NULL,
  live_event_id UUID, -- referencia a live_events
  live_offer_id UUID, -- referencia a live_offers
  description TEXT NOT NULL,
  image_url TEXT,
  quantity INT NOT NULL DEFAULT 1,
  unit_price NUMERIC(10,2) NOT NULL,
  subtotal NUMERIC(10,2) NOT NULL
);

CREATE INDEX idx_order_items_order ON order_items(order_id);

-- ============================================================
-- TABLA: live_events
-- ============================================================
CREATE TABLE live_events (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  type live_event_type NOT NULL,
  title TEXT NOT NULL,
  description TEXT,
  status live_event_status NOT NULL DEFAULT 'draft',
  cover_image TEXT,
  total_revenue NUMERIC(10,2) DEFAULT 0,
  total_buyers INT DEFAULT 0,
  queue_open BOOLEAN DEFAULT FALSE,
  started_at TIMESTAMPTZ,
  finished_at TIMESTAMPTZ,
  created_by UUID REFERENCES profiles(id),
  created_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX idx_live_events_status ON live_events(status);

-- ============================================================
-- TABLA: live_offers
-- ============================================================
CREATE TABLE live_offers (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  event_id UUID NOT NULL REFERENCES live_events(id) ON DELETE CASCADE,
  name TEXT NOT NULL,
  description TEXT,
  unit_count INT NOT NULL DEFAULT 1,
  price NUMERIC(10,2) NOT NULL,
  total_stock INT NOT NULL,
  sold_count INT DEFAULT 0,
  reserved_count INT DEFAULT 0,
  display_order INT DEFAULT 0,
  is_active BOOLEAN DEFAULT TRUE,
  released_count INT DEFAULT 0, -- para SOBRES: cuántos liberó admin
  image_url TEXT,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX idx_live_offers_event ON live_offers(event_id);

-- ============================================================
-- TABLA: live_purchases (corazón del módulo LIVE)
-- ============================================================
CREATE TABLE live_purchases (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  event_id UUID NOT NULL REFERENCES live_events(id) ON DELETE CASCADE,
  offer_id UUID NOT NULL REFERENCES live_offers(id) ON DELETE CASCADE,
  user_id UUID NOT NULL REFERENCES profiles(id),
  order_id UUID REFERENCES orders(id) ON DELETE SET NULL,
  status live_purchase_status NOT NULL DEFAULT 'queued',
  queue_position INT,
  amount NUMERIC(10,2) NOT NULL,
  reserved_until TIMESTAMPTZ,
  mp_preference_id TEXT,
  mp_payment_id TEXT,
  mp_init_point TEXT,
  paid_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX idx_live_purchases_event ON live_purchases(event_id, status);
CREATE INDEX idx_live_purchases_user ON live_purchases(user_id);
CREATE INDEX idx_live_purchases_queue ON live_purchases(event_id, queue_position) WHERE status IN ('queued', 'paying');
CREATE INDEX idx_live_purchases_expiry ON live_purchases(reserved_until) WHERE status = 'paying';

-- ============================================================
-- TABLA: live_chat_messages
-- ============================================================
CREATE TABLE live_chat_messages (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  event_id UUID NOT NULL REFERENCES live_events(id) ON DELETE CASCADE,
  user_id UUID NOT NULL REFERENCES profiles(id),
  message TEXT NOT NULL,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX idx_chat_event ON live_chat_messages(event_id, created_at DESC);

-- ============================================================
-- FUNCIÓN: comprar en LIVE (atomic)
-- ============================================================
CREATE OR REPLACE FUNCTION buy_live_offer(
  p_event_id UUID,
  p_offer_id UUID,
  p_user_id UUID
) RETURNS JSONB AS $$
DECLARE
  v_offer live_offers;
  v_event live_events;
  v_purchase_id UUID;
  v_position INT;
  v_available INT;
  v_existing UUID;
BEGIN
  -- Verificar evento activo
  SELECT * INTO v_event FROM live_events WHERE id = p_event_id;
  IF v_event.status != 'active' THEN
    RETURN jsonb_build_object('success', false, 'error', 'event_not_active');
  END IF;

  -- Verificar si el usuario ya tiene una compra activa en esta oferta
  SELECT id INTO v_existing FROM live_purchases
  WHERE offer_id = p_offer_id
    AND user_id = p_user_id
    AND status IN ('queued', 'paying');
  IF v_existing IS NOT NULL THEN
    RETURN jsonb_build_object('success', false, 'error', 'already_in_queue', 'purchase_id', v_existing);
  END IF;

  -- Lock de la oferta
  SELECT * INTO v_offer FROM live_offers WHERE id = p_offer_id FOR UPDATE;

  IF NOT v_offer.is_active THEN
    RETURN jsonb_build_object('success', false, 'error', 'offer_inactive');
  END IF;

  -- Para SOBRES: solo se puede comprar si hay sobres "released" disponibles
  IF v_event.type = 'sobres' THEN
    v_available := v_offer.released_count - v_offer.sold_count - v_offer.reserved_count;
  ELSE
    v_available := v_offer.total_stock - v_offer.sold_count - v_offer.reserved_count;
  END IF;

  -- Para BOLSITAS: requiere fila abierta
  IF v_event.type = 'bolsitas' AND NOT v_event.queue_open THEN
    RETURN jsonb_build_object('success', false, 'error', 'queue_closed');
  END IF;

  IF v_available > 0 THEN
    -- Hay stock: pasar directo a 'paying'
    UPDATE live_offers
    SET reserved_count = reserved_count + 1
    WHERE id = p_offer_id;

    INSERT INTO live_purchases (event_id, offer_id, user_id, status, amount, reserved_until)
    VALUES (p_event_id, p_offer_id, p_user_id, 'paying', v_offer.price, NOW() + INTERVAL '3 minutes')
    RETURNING id INTO v_purchase_id;

    RETURN jsonb_build_object('success', true, 'status', 'paying', 'purchase_id', v_purchase_id);
  ELSE
    -- No hay stock: encolar (solo para bolsitas y sobres)
    IF v_event.type = 'capsulas' THEN
      RETURN jsonb_build_object('success', false, 'error', 'sold_out');
    END IF;

    SELECT COALESCE(MAX(queue_position), 0) + 1 INTO v_position
    FROM live_purchases
    WHERE event_id = p_event_id AND status = 'queued';

    INSERT INTO live_purchases (event_id, offer_id, user_id, status, amount, queue_position)
    VALUES (p_event_id, p_offer_id, p_user_id, 'queued', v_offer.price, v_position)
    RETURNING id INTO v_purchase_id;

    RETURN jsonb_build_object('success', true, 'status', 'queued', 'purchase_id', v_purchase_id, 'position', v_position);
  END IF;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- ============================================================
-- FUNCIÓN: confirmar pago LIVE (llamada por webhook)
-- ============================================================
CREATE OR REPLACE FUNCTION confirm_live_payment(
  p_purchase_id UUID,
  p_mp_payment_id TEXT
) RETURNS UUID AS $$
DECLARE
  v_purchase live_purchases;
  v_offer live_offers;
  v_event live_events;
  v_user profiles;
  v_order_id UUID;
BEGIN
  SELECT * INTO v_purchase FROM live_purchases WHERE id = p_purchase_id FOR UPDATE;

  IF v_purchase.status = 'paid' THEN
    RETURN v_purchase.order_id; -- ya estaba pagada
  END IF;

  SELECT * INTO v_offer FROM live_offers WHERE id = v_purchase.offer_id FOR UPDATE;
  SELECT * INTO v_event FROM live_events WHERE id = v_purchase.event_id;
  SELECT * INTO v_user FROM profiles WHERE id = v_purchase.user_id;

  -- Crear orden
  INSERT INTO orders (user_id, status, source, subtotal, total, mp_payment_id, mp_status, paid_at)
  VALUES (v_purchase.user_id, 'paid', 'live', v_purchase.amount, v_purchase.amount, p_mp_payment_id, 'approved', NOW())
  RETURNING id INTO v_order_id;

  INSERT INTO order_items (order_id, live_event_id, live_offer_id, description, quantity, unit_price, subtotal, image_url)
  VALUES (
    v_order_id,
    v_purchase.event_id,
    v_purchase.offer_id,
    v_offer.name || ' - ' || v_event.title,
    1,
    v_purchase.amount,
    v_purchase.amount,
    v_offer.image_url
  );

  -- Actualizar la compra
  UPDATE live_purchases
  SET status = 'paid', order_id = v_order_id, paid_at = NOW(), mp_payment_id = p_mp_payment_id
  WHERE id = p_purchase_id;

  -- Mover de reserved a sold
  UPDATE live_offers
  SET sold_count = sold_count + 1, reserved_count = GREATEST(reserved_count - 1, 0)
  WHERE id = v_purchase.offer_id;

  -- Actualizar contadores del evento
  UPDATE live_events
  SET total_revenue = total_revenue + v_purchase.amount,
      total_buyers = total_buyers + 1
  WHERE id = v_purchase.event_id;

  RETURN v_order_id;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- ============================================================
-- FUNCIÓN: expirar locks vencidos y avanzar fila
-- ============================================================
CREATE OR REPLACE FUNCTION expire_old_locks() RETURNS INT AS $$
DECLARE
  v_expired RECORD;
  v_next RECORD;
  v_count INT := 0;
BEGIN
  -- Buscar todas las compras 'paying' vencidas
  FOR v_expired IN
    SELECT * FROM live_purchases
    WHERE status = 'paying' AND reserved_until < NOW()
  LOOP
    -- Marcar como expirada
    UPDATE live_purchases SET status = 'expired' WHERE id = v_expired.id;

    -- Liberar reserva
    UPDATE live_offers SET reserved_count = GREATEST(reserved_count - 1, 0)
    WHERE id = v_expired.offer_id;

    -- Buscar próximo en fila
    SELECT * INTO v_next FROM live_purchases
    WHERE event_id = v_expired.event_id
      AND offer_id = v_expired.offer_id
      AND status = 'queued'
    ORDER BY queue_position ASC
    LIMIT 1;

    IF v_next.id IS NOT NULL THEN
      UPDATE live_offers SET reserved_count = reserved_count + 1
      WHERE id = v_expired.offer_id;

      UPDATE live_purchases
      SET status = 'paying',
          reserved_until = NOW() + INTERVAL '3 minutes'
      WHERE id = v_next.id;
    END IF;

    v_count := v_count + 1;
  END LOOP;

  RETURN v_count;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- ============================================================
-- FUNCIÓN: liberar siguiente sobre (admin manual)
-- ============================================================
CREATE OR REPLACE FUNCTION release_next_sobre(p_offer_id UUID) RETURNS BOOLEAN AS $$
DECLARE
  v_offer live_offers;
BEGIN
  SELECT * INTO v_offer FROM live_offers WHERE id = p_offer_id FOR UPDATE;

  IF v_offer.released_count >= v_offer.total_stock THEN
    RETURN FALSE;
  END IF;

  UPDATE live_offers SET released_count = released_count + 1 WHERE id = p_offer_id;
  RETURN TRUE;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- ============================================================
-- ROW LEVEL SECURITY
-- ============================================================

-- profiles
ALTER TABLE profiles ENABLE ROW LEVEL SECURITY;

CREATE POLICY "users_read_own_profile" ON profiles FOR SELECT USING (auth.uid() = id);
CREATE POLICY "users_update_own_profile" ON profiles FOR UPDATE USING (auth.uid() = id);
CREATE POLICY "admins_read_all_profiles" ON profiles FOR SELECT USING (
  EXISTS (SELECT 1 FROM profiles p WHERE p.id = auth.uid() AND p.role = 'admin')
);

-- addresses
ALTER TABLE addresses ENABLE ROW LEVEL SECURITY;
CREATE POLICY "users_manage_own_addresses" ON addresses FOR ALL USING (auth.uid() = user_id);

-- categories: lectura pública, edición admin
ALTER TABLE categories ENABLE ROW LEVEL SECURITY;
CREATE POLICY "public_reads_categories" ON categories FOR SELECT USING (is_active);
CREATE POLICY "admins_manage_categories" ON categories FOR ALL USING (
  EXISTS (SELECT 1 FROM profiles WHERE id = auth.uid() AND role = 'admin')
);

-- products: lectura pública (solo activos), edición admin
ALTER TABLE products ENABLE ROW LEVEL SECURITY;
CREATE POLICY "public_reads_active_products" ON products FOR SELECT USING (status = 'active');
CREATE POLICY "admins_read_all_products" ON products FOR SELECT USING (
  EXISTS (SELECT 1 FROM profiles WHERE id = auth.uid() AND role = 'admin')
);
CREATE POLICY "admins_manage_products" ON products FOR ALL USING (
  EXISTS (SELECT 1 FROM profiles WHERE id = auth.uid() AND role = 'admin')
);

-- product_variants
ALTER TABLE product_variants ENABLE ROW LEVEL SECURITY;
CREATE POLICY "public_reads_variants" ON product_variants FOR SELECT USING (true);
CREATE POLICY "admins_manage_variants" ON product_variants FOR ALL USING (
  EXISTS (SELECT 1 FROM profiles WHERE id = auth.uid() AND role = 'admin')
);

-- carts
ALTER TABLE carts ENABLE ROW LEVEL SECURITY;
CREATE POLICY "users_manage_own_cart" ON carts FOR ALL USING (auth.uid() = user_id);

-- cart_items
ALTER TABLE cart_items ENABLE ROW LEVEL SECURITY;
CREATE POLICY "users_manage_own_cart_items" ON cart_items FOR ALL USING (
  EXISTS (SELECT 1 FROM carts WHERE id = cart_items.cart_id AND user_id = auth.uid())
);

-- orders
ALTER TABLE orders ENABLE ROW LEVEL SECURITY;
CREATE POLICY "users_read_own_orders" ON orders FOR SELECT USING (auth.uid() = user_id);
CREATE POLICY "admins_read_all_orders" ON orders FOR SELECT USING (
  EXISTS (SELECT 1 FROM profiles WHERE id = auth.uid() AND role = 'admin')
);
CREATE POLICY "admins_update_orders" ON orders FOR UPDATE USING (
  EXISTS (SELECT 1 FROM profiles WHERE id = auth.uid() AND role = 'admin')
);

-- order_items
ALTER TABLE order_items ENABLE ROW LEVEL SECURITY;
CREATE POLICY "users_read_own_order_items" ON order_items FOR SELECT USING (
  EXISTS (SELECT 1 FROM orders WHERE id = order_items.order_id AND user_id = auth.uid())
);
CREATE POLICY "admins_read_all_order_items" ON order_items FOR SELECT USING (
  EXISTS (SELECT 1 FROM profiles WHERE id = auth.uid() AND role = 'admin')
);

-- live_events: público lee activos, admin gestiona todo
ALTER TABLE live_events ENABLE ROW LEVEL SECURITY;
CREATE POLICY "public_reads_active_events" ON live_events FOR SELECT USING (
  status IN ('active', 'paused', 'finished')
);
CREATE POLICY "admins_manage_events" ON live_events FOR ALL USING (
  EXISTS (SELECT 1 FROM profiles WHERE id = auth.uid() AND role = 'admin')
);

-- live_offers
ALTER TABLE live_offers ENABLE ROW LEVEL SECURITY;
CREATE POLICY "public_reads_offers" ON live_offers FOR SELECT USING (true);
CREATE POLICY "admins_manage_offers" ON live_offers FOR ALL USING (
  EXISTS (SELECT 1 FROM profiles WHERE id = auth.uid() AND role = 'admin')
);

-- live_purchases
ALTER TABLE live_purchases ENABLE ROW LEVEL SECURITY;
CREATE POLICY "users_read_own_purchases" ON live_purchases FOR SELECT USING (auth.uid() = user_id);
CREATE POLICY "admins_read_all_purchases" ON live_purchases FOR SELECT USING (
  EXISTS (SELECT 1 FROM profiles WHERE id = auth.uid() AND role = 'admin')
);
-- Las inserciones se hacen por la función buy_live_offer (SECURITY DEFINER)

-- live_chat_messages
ALTER TABLE live_chat_messages ENABLE ROW LEVEL SECURITY;
CREATE POLICY "public_reads_chat" ON live_chat_messages FOR SELECT USING (true);
CREATE POLICY "auth_users_post_chat" ON live_chat_messages FOR INSERT WITH CHECK (auth.uid() = user_id);

-- ============================================================
-- REALTIME
-- ============================================================
-- Habilitar Realtime para las tablas que lo necesitan
-- (esto se hace también desde el dashboard de Supabase)
ALTER PUBLICATION supabase_realtime ADD TABLE live_events;
ALTER PUBLICATION supabase_realtime ADD TABLE live_offers;
ALTER PUBLICATION supabase_realtime ADD TABLE live_purchases;
ALTER PUBLICATION supabase_realtime ADD TABLE live_chat_messages;

-- ============================================================
-- DATOS INICIALES (seed)
-- ============================================================
INSERT INTO categories (name, slug, display_order) VALUES
  ('Lencería', 'lenceria', 1),
  ('Cosmética', 'cosmetica', 2),
  ('Accesorios', 'accesorios', 3),
  ('Wellness', 'wellness', 4),
  ('Promos', 'promos', 5);

-- Producto demo
INSERT INTO products (name, slug, description, category_id, price, compare_price, stock, status, is_featured, images)
SELECT
  'Set Pétalos',
  'set-petalos',
  'Set delicado pensado para vos. Tela suave, encaje hecho con amor.',
  id,
  18500,
  22000,
  15,
  'active',
  TRUE,
  ARRAY['https://images.unsplash.com/photo-1566174053879-31528523f8ae?w=800']
FROM categories WHERE slug = 'lenceria' LIMIT 1;

-- IMPORTANTE: para crear el primer admin, ejecutá manualmente después de registrarte:
-- UPDATE profiles SET role = 'admin' WHERE email = 'TU_EMAIL@example.com';
