-- ============================================================
-- Carrito expira a los 10 minutos sin actividad
-- ============================================================
-- - Trigger en cart_items que toca carts.updated_at en cada
--   insert/update/delete → cualquier movimiento en el cart resetea el timer.
-- - RPC expire_old_carts() que marca como 'expired' los carts active
--   con updated_at más viejo que 10 minutos. La llaman desde el frontend
--   cuando el usuario abre el checkout (lazy cleanup).
-- - Carts en status 'expired' NO se leen por el cliente (RLS lo filtra
--   por status='active' implícito en las queries del front).
-- ============================================================

-- Trigger: cualquier movimiento en cart_items toca el updated_at del cart padre.
CREATE OR REPLACE FUNCTION touch_cart_updated_at()
RETURNS TRIGGER AS $$
BEGIN
  UPDATE carts
  SET updated_at = NOW()
  WHERE id = COALESCE(NEW.cart_id, OLD.cart_id);
  RETURN COALESCE(NEW, OLD);
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS trg_cart_items_touch_cart ON cart_items;
CREATE TRIGGER trg_cart_items_touch_cart
AFTER INSERT OR UPDATE OR DELETE ON cart_items
FOR EACH ROW EXECUTE FUNCTION touch_cart_updated_at();

-- RPC: marca como 'expired' carts activos sin actividad >10 min.
-- Devuelve cuántos cerró (para logging). Idempotente.
CREATE OR REPLACE FUNCTION expire_old_carts()
RETURNS INT
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
  affected INT;
BEGIN
  UPDATE carts
  SET status = 'expired'
  WHERE status = 'active'
    AND updated_at < NOW() - INTERVAL '10 minutes';
  GET DIAGNOSTICS affected = ROW_COUNT;
  RETURN affected;
END;
$$;

GRANT EXECUTE ON FUNCTION expire_old_carts() TO anon, authenticated, service_role;

-- Notificamos a PostgREST para que recargue el schema cache.
NOTIFY pgrst, 'reload schema';
