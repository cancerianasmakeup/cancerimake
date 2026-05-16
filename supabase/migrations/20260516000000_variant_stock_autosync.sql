-- ============================================================
-- products.stock = SUM(product_variants.stock) cuando hay variantes
-- ============================================================
-- Regla: si un producto tiene variantes, su stock general es la suma
-- del stock de cada variante. Si no tiene variantes, products.stock
-- se maneja manualmente desde el admin.
--
-- Implementación: trigger AFTER INSERT/UPDATE OF stock/DELETE en
-- product_variants que recalcula products.stock para el producto
-- afectado.

CREATE OR REPLACE FUNCTION sync_product_stock_from_variants()
RETURNS TRIGGER AS $$
DECLARE
  target_product_id UUID;
  variant_count INT;
  total_stock INT;
BEGIN
  -- Determinar qué producto recalcular según la operación
  IF TG_OP = 'DELETE' THEN
    target_product_id := OLD.product_id;
  ELSE
    target_product_id := NEW.product_id;
  END IF;

  -- Si NEW.product_id cambió respecto a OLD.product_id en un UPDATE,
  -- recalcular ambos. (Caso raro pero posible.)
  IF TG_OP = 'UPDATE' AND OLD.product_id <> NEW.product_id THEN
    SELECT COUNT(*), COALESCE(SUM(stock), 0) INTO variant_count, total_stock
    FROM product_variants WHERE product_id = OLD.product_id;
    IF variant_count > 0 THEN
      UPDATE products SET stock = total_stock WHERE id = OLD.product_id;
    END IF;
  END IF;

  SELECT COUNT(*), COALESCE(SUM(stock), 0) INTO variant_count, total_stock
  FROM product_variants WHERE product_id = target_product_id;

  -- Solo sincronizar si el producto sigue teniendo variantes.
  -- Si la última variante se eliminó, dejamos products.stock como está
  -- (el admin decide cuánto stock general queda).
  IF variant_count > 0 THEN
    UPDATE products SET stock = total_stock WHERE id = target_product_id;
  END IF;

  RETURN NULL;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

DROP TRIGGER IF EXISTS trg_sync_product_stock_from_variants ON product_variants;

CREATE TRIGGER trg_sync_product_stock_from_variants
AFTER INSERT OR UPDATE OF stock, product_id OR DELETE ON product_variants
FOR EACH ROW
EXECUTE FUNCTION sync_product_stock_from_variants();

-- Backfill: corregir productos existentes que tengan variantes pero stock desincronizado
UPDATE products p
SET stock = sub.total
FROM (
  SELECT product_id, COALESCE(SUM(stock), 0)::INT AS total
  FROM product_variants
  GROUP BY product_id
) sub
WHERE p.id = sub.product_id
  AND p.stock <> sub.total;

NOTIFY pgrst, 'reload schema';
