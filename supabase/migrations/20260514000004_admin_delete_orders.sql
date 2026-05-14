-- Permitir que admin elimine órdenes (con sus order_items + shipments asociados
-- vía ON DELETE CASCADE / SET NULL que ya existen en el schema).

DROP POLICY IF EXISTS "admins_delete_orders" ON public.orders;
CREATE POLICY "admins_delete_orders" ON public.orders
  FOR DELETE TO authenticated
  USING (public.is_admin());

DROP POLICY IF EXISTS "admins_delete_order_items" ON public.order_items;
CREATE POLICY "admins_delete_order_items" ON public.order_items
  FOR DELETE TO authenticated
  USING (public.is_admin());

-- Para shipments, el schema inicial ya tiene "admins_manage_shipments" FOR ALL,
-- así que admin puede DELETE también. No agregamos nada extra.
