-- ============================================================
-- CÓDIGO DE BARRAS por producto
-- ============================================================
-- Guarda el código impreso en el packaging (EAN-13, UPC, Code128, o el
-- interno que le pongamos con una etiquetadora). Sirve para armar
-- presupuestos/remitos escaneando con una pistola lectora: el lector
-- "tipea" el código y da Enter, y el producto entra solo.
--
-- - Es opcional (NULL / '' = producto sin código cargado).
-- - Índice único PARCIAL: no permite dos productos con el mismo código,
--   pero sí muchos productos sin código.
-- - Se guarda tal cual se escanea, sin espacios en los extremos.

ALTER TABLE products
  ADD COLUMN IF NOT EXISTS barcode TEXT;

CREATE UNIQUE INDEX IF NOT EXISTS products_barcode_unique_idx
  ON products (barcode)
  WHERE barcode IS NOT NULL AND barcode <> '';

-- Búsqueda rápida por código en el picker de remitos.
COMMENT ON COLUMN products.barcode IS
  'Código de barras del producto (EAN/UPC/Code128 o interno). Único cuando no es NULL.';

NOTIFY pgrst, 'reload schema';
