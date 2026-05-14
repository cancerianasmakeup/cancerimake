-- ============================================================
-- Sincronización order <-> shipment.
--
-- Mantiene los estados coherentes sin importar desde dónde haga el cambio
-- el admin (/admin/orders/[id] o /admin/shipments/[id]):
--
--   shipment.status -> order.status (este archivo: vía trigger)
--   order.status    -> shipment.status (en el código: handlers de UI)
--
-- Sólo propagamos los cambios "terminales" donde realmente hay correspondencia
-- 1 a 1 entre los dos enums:
--   shipment.dispatched -> order.shipped
--   shipment.delivered  -> order.delivered
--
-- Los otros estados (pending_address, pending_payment, paid del envío, etc.)
-- son específicos del shipment y NO se reflejan en order.status — eso lo
-- maneja el admin con el botón "Marcar como preparando" después de aprobar
-- el pago del envío (badge contextual "ENVÍO PAGO").
-- ============================================================

CREATE OR REPLACE FUNCTION public.sync_order_from_shipment()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
BEGIN
  -- Sólo nos interesan cambios de status
  IF NEW.status IS NOT DISTINCT FROM OLD.status THEN
    RETURN NEW;
  END IF;
  -- Si no hay orden vinculada (caso de shipments sueltos del LIVE), nada que hacer
  IF NEW.order_id IS NULL THEN
    RETURN NEW;
  END IF;

  IF NEW.status = 'dispatched'::shipment_status THEN
    UPDATE public.orders
    SET status     = 'shipped'::order_status,
        shipped_at = COALESCE(shipped_at, NEW.dispatched_at, now())
    WHERE id = NEW.order_id
      AND status NOT IN ('shipped'::order_status, 'delivered'::order_status, 'cancelled'::order_status);
  ELSIF NEW.status = 'delivered'::shipment_status THEN
    UPDATE public.orders
    SET status       = 'delivered'::order_status,
        delivered_at = COALESCE(delivered_at, NEW.delivered_at, now())
    WHERE id = NEW.order_id
      AND status NOT IN ('delivered'::order_status, 'cancelled'::order_status);
  END IF;

  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_sync_order_from_shipment ON public.shipments;
CREATE TRIGGER trg_sync_order_from_shipment
  AFTER UPDATE OF status ON public.shipments
  FOR EACH ROW EXECUTE FUNCTION public.sync_order_from_shipment();
