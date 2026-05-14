-- ============================================================
-- FIX: RLS INSERT en orders + order_items.
-- ============================================================
-- El schema inicial habilitó RLS en orders y order_items pero sólo creó
-- policies para SELECT y UPDATE. Sin INSERT policy, ningún cliente puede
-- crear órdenes (sale "new row violates row-level security policy").
--
-- carts/cart_items sí tienen "FOR ALL" así que andaban bien — por eso el
-- bug pasó desapercibido hasta que el checkout intentó hacer el INSERT
-- directo desde el browser.
-- ============================================================

DROP POLICY IF EXISTS "users_insert_own_orders" ON public.orders;
CREATE POLICY "users_insert_own_orders" ON public.orders
  FOR INSERT TO authenticated
  WITH CHECK (auth.uid() = user_id);

-- order_items: el cliente puede insertar items en sus propias órdenes
DROP POLICY IF EXISTS "users_insert_own_order_items" ON public.order_items;
CREATE POLICY "users_insert_own_order_items" ON public.order_items
  FOR INSERT TO authenticated
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM public.orders o
      WHERE o.id = order_id
        AND o.user_id = auth.uid()
    )
  );
