-- Fix: la policy admins_read_all_profiles causaba recursión infinita
-- porque consultaba profiles desde adentro de una policy de profiles.
-- Solución: helper function SECURITY DEFINER que bypassea RLS al chequear el rol admin.

CREATE OR REPLACE FUNCTION public.is_admin()
RETURNS BOOLEAN
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT EXISTS (
    SELECT 1 FROM public.profiles
    WHERE id = auth.uid() AND role = 'admin'
  );
$$;

GRANT EXECUTE ON FUNCTION public.is_admin() TO anon, authenticated;

-- Reemplazar todas las policies que usaban EXISTS(SELECT FROM profiles ...)
-- por is_admin() para evitar la recursión y de paso ganar performance.

DROP POLICY IF EXISTS "admins_read_all_profiles" ON profiles;
CREATE POLICY "admins_read_all_profiles" ON profiles FOR SELECT USING (public.is_admin());

DROP POLICY IF EXISTS "admins_manage_categories" ON categories;
CREATE POLICY "admins_manage_categories" ON categories FOR ALL USING (public.is_admin());

DROP POLICY IF EXISTS "admins_read_all_products" ON products;
CREATE POLICY "admins_read_all_products" ON products FOR SELECT USING (public.is_admin());

DROP POLICY IF EXISTS "admins_manage_products" ON products;
CREATE POLICY "admins_manage_products" ON products FOR ALL USING (public.is_admin());

DROP POLICY IF EXISTS "admins_manage_variants" ON product_variants;
CREATE POLICY "admins_manage_variants" ON product_variants FOR ALL USING (public.is_admin());

DROP POLICY IF EXISTS "admins_read_all_orders" ON orders;
CREATE POLICY "admins_read_all_orders" ON orders FOR SELECT USING (public.is_admin());

DROP POLICY IF EXISTS "admins_update_orders" ON orders;
CREATE POLICY "admins_update_orders" ON orders FOR UPDATE USING (public.is_admin());

DROP POLICY IF EXISTS "admins_read_all_order_items" ON order_items;
CREATE POLICY "admins_read_all_order_items" ON order_items FOR SELECT USING (public.is_admin());

DROP POLICY IF EXISTS "admins_manage_events" ON live_events;
CREATE POLICY "admins_manage_events" ON live_events FOR ALL USING (public.is_admin());

DROP POLICY IF EXISTS "admins_manage_offers" ON live_offers;
CREATE POLICY "admins_manage_offers" ON live_offers FOR ALL USING (public.is_admin());

DROP POLICY IF EXISTS "admins_read_all_purchases" ON live_purchases;
CREATE POLICY "admins_read_all_purchases" ON live_purchases FOR SELECT USING (public.is_admin());

NOTIFY pgrst, 'reload schema';
