-- ============================================================
-- Migración: product_categories (multi-categoría por producto)
-- ============================================================
-- Permite que un producto pertenezca a N categorías.
-- Una se marca como "primary" (la que se usa por defecto para
-- breadcrumbs, productos relacionados, etc).
-- Backfillea desde products.category_id existente.
-- Mantiene products.category_id como columna legacy sincronizada
-- vía trigger para no romper código que aún la lee.
-- ============================================================

CREATE TABLE IF NOT EXISTS product_categories (
  product_id UUID NOT NULL REFERENCES products(id) ON DELETE CASCADE,
  category_id UUID NOT NULL REFERENCES categories(id) ON DELETE CASCADE,
  is_primary BOOLEAN NOT NULL DEFAULT FALSE,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  PRIMARY KEY (product_id, category_id)
);

CREATE INDEX IF NOT EXISTS idx_product_categories_product  ON product_categories(product_id);
CREATE INDEX IF NOT EXISTS idx_product_categories_category ON product_categories(category_id);

-- Sólo puede haber UNA categoría primary por producto.
CREATE UNIQUE INDEX IF NOT EXISTS uniq_product_primary_category
  ON product_categories(product_id) WHERE is_primary = TRUE;

-- Backfill: todo producto con category_id existente queda como primary.
INSERT INTO product_categories (product_id, category_id, is_primary)
SELECT id, category_id, TRUE
FROM products
WHERE category_id IS NOT NULL
ON CONFLICT (product_id, category_id) DO NOTHING;

-- Trigger: mantener products.category_id sincronizado con la primary
-- (lo dejamos como columna denormalizada por backward-compat de queries).
CREATE OR REPLACE FUNCTION sync_product_primary_category()
RETURNS TRIGGER LANGUAGE plpgsql AS $$
BEGIN
  IF (TG_OP = 'DELETE') THEN
    IF OLD.is_primary THEN
      UPDATE products
      SET category_id = (
        SELECT category_id FROM product_categories
        WHERE product_id = OLD.product_id
        ORDER BY created_at ASC LIMIT 1
      )
      WHERE id = OLD.product_id;
    END IF;
    RETURN OLD;
  END IF;

  IF NEW.is_primary THEN
    UPDATE products SET category_id = NEW.category_id WHERE id = NEW.product_id;
  ELSIF NOT EXISTS (
    SELECT 1 FROM product_categories
    WHERE product_id = NEW.product_id AND is_primary = TRUE
  ) THEN
    UPDATE products SET category_id = NEW.category_id WHERE id = NEW.product_id AND category_id IS NULL;
  END IF;

  RETURN NEW;
END $$;

DROP TRIGGER IF EXISTS trg_sync_product_primary_category ON product_categories;
CREATE TRIGGER trg_sync_product_primary_category
AFTER INSERT OR UPDATE OR DELETE ON product_categories
FOR EACH ROW EXECUTE FUNCTION sync_product_primary_category();

-- RLS
ALTER TABLE product_categories ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Anyone can read product categories" ON product_categories;
CREATE POLICY "Anyone can read product categories" ON product_categories
  FOR SELECT USING (TRUE);

DROP POLICY IF EXISTS "Admins manage product categories" ON product_categories;
CREATE POLICY "Admins manage product categories" ON product_categories
  FOR ALL USING (
    EXISTS (SELECT 1 FROM profiles WHERE id = auth.uid() AND role = 'admin')
  );

GRANT SELECT ON product_categories TO anon, authenticated;
GRANT ALL ON product_categories TO service_role;
