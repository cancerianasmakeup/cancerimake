-- ============================================================
-- COSTO INTERNO + DIMENSIONES FÍSICAS DE PRODUCTOS
-- ============================================================
-- · `cost` (NUMERIC) — lo que nos sale comprar el producto. Inicialmente 0
--   cuando lo carga marketing/contenido; después un empleado lo completa
--   para calcular margen. NO se muestra en la web pública.
--
-- · `length_cm` / `width_cm` / `height_cm` — dimensiones físicas para que el
--   helper `calcPackageFromCart` arme un paquete realista al cotizar envío.
--   El `weight_grams` ya existía.

ALTER TABLE products
  ADD COLUMN IF NOT EXISTS cost NUMERIC(10,2) NOT NULL DEFAULT 0 CHECK (cost >= 0),
  ADD COLUMN IF NOT EXISTS length_cm INTEGER CHECK (length_cm IS NULL OR length_cm > 0),
  ADD COLUMN IF NOT EXISTS width_cm  INTEGER CHECK (width_cm  IS NULL OR width_cm  > 0),
  ADD COLUMN IF NOT EXISTS height_cm INTEGER CHECK (height_cm IS NULL OR height_cm > 0);

-- RLS: cost no se filtra a nivel SQL — la API lo expone, pero los
-- componentes públicos no lo seleccionan. Si querés ocultarlo a anon,
-- agregá una vista pública sin la columna y revocá SELECT en products
-- para anon. Por ahora dejamos abierto (es información de negocio interno
-- pero no es PII ni crítica).

NOTIFY pgrst, 'reload schema';
