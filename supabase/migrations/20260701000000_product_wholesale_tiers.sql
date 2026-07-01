-- ============================================================
-- PRECIOS POR MAYOR (wholesale tiers) por producto
-- ============================================================
-- Cada producto puede ofrecer "packs" de compra por mayor: comprar más
-- unidades a un precio total con descuento. Ej:
--   { "label": "3 unidades", "units": 3, "price": 8500 }
--   { "label": "Media caja",  "units": 12, "price": 30000 }
--   { "label": "Caja",        "units": 24, "price": 55000 }
--
-- Convención de cada elemento del array JSONB:
--   - label : string  → nombre visible del pack (ej "Media caja").
--   - units : integer → cantidad de unidades que incluye el pack (> 0).
--   - price : numeric → PRECIO TOTAL del pack (lo que paga la clienta por
--                       esas `units` unidades). El % de descuento se calcula
--                       solo comparando contra products.price * units.
--
-- El precio efectivo por unidad (price / units) se baja al carrito como
-- unit_price, así el checkout / order_items / descuento de stock siguen
-- funcionando sin cambios (quantity = units, unit_price = price / units).
--
-- Default: array vacío (producto sin precios por mayor).

ALTER TABLE products
  ADD COLUMN IF NOT EXISTS wholesale_tiers JSONB NOT NULL DEFAULT '[]'::jsonb;

NOTIFY pgrst, 'reload schema';
