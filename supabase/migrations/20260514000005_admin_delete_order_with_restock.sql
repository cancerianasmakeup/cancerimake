-- ============================================================
-- RPC: borrar una orden + devolver stock de cada item al producto/variante.
--
-- Antes de borrar la orden, recorre order_items e incrementa el stock
-- de cada variant_id (si tiene) o product_id correspondiente. Después
-- borra los shipments asociados y finalmente la orden (los order_items
-- caen por CASCADE).
--
-- Solo admins pueden ejecutarla (SECURITY DEFINER + check is_admin).
-- ============================================================

CREATE OR REPLACE FUNCTION public.increment_product_stock(p_product_id UUID, p_qty INT)
RETURNS VOID AS $$
BEGIN
  UPDATE public.products SET stock = stock + p_qty WHERE id = p_product_id;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

CREATE OR REPLACE FUNCTION public.increment_variant_stock(p_variant_id UUID, p_qty INT)
RETURNS VOID AS $$
BEGIN
  UPDATE public.product_variants SET stock = stock + p_qty WHERE id = p_variant_id;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;


CREATE OR REPLACE FUNCTION public.admin_delete_order_with_restock(p_order_id UUID)
RETURNS VOID
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
DECLARE
  v_item RECORD;
  v_status TEXT;
BEGIN
  IF NOT public.is_admin() THEN
    RAISE EXCEPTION 'Solo admins pueden ejecutar esta función';
  END IF;

  -- Sólo devolvemos stock si la orden estuvo paga (o avanzada): si la orden
  -- nunca llegó a paid el stock nunca se descontó.
  SELECT status::TEXT INTO v_status FROM public.orders WHERE id = p_order_id;
  IF v_status IS NULL THEN
    RAISE EXCEPTION 'Orden no encontrada';
  END IF;

  IF v_status IN ('paid', 'preparing', 'shipped', 'delivered') THEN
    FOR v_item IN
      SELECT product_id, variant_id, quantity FROM public.order_items WHERE order_id = p_order_id
    LOOP
      IF v_item.variant_id IS NOT NULL THEN
        PERFORM public.increment_variant_stock(v_item.variant_id, v_item.quantity);
      END IF;
      IF v_item.product_id IS NOT NULL THEN
        PERFORM public.increment_product_stock(v_item.product_id, v_item.quantity);
      END IF;
    END LOOP;
  END IF;

  -- Borramos shipments vinculados (no tienen ON DELETE CASCADE desde orders)
  DELETE FROM public.shipments WHERE order_id = p_order_id;

  -- Y la orden (order_items se borran por CASCADE)
  DELETE FROM public.orders WHERE id = p_order_id;
END;
$$;

GRANT EXECUTE ON FUNCTION public.admin_delete_order_with_restock(UUID) TO authenticated;
