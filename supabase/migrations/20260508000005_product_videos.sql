-- ============================================================
-- VIDEOS de producto
-- ============================================================
-- Algunos productos tienen video oficial del fabricante (carrusel).
-- Lo guardamos en una columna `videos TEXT[]` paralela a `images`,
-- así podemos mostrarlos en el carrusel del product detail.
--
-- Convención:
--   - Cada elemento del array es la URL completa al archivo de video
--     (.mp4, .webm, .mov) o a un embed (YouTube/Vimeo) — el componente
--     Gallery decide cómo renderizarlo.
--   - Default empty array.

ALTER TABLE products
  ADD COLUMN IF NOT EXISTS videos TEXT[] NOT NULL DEFAULT ARRAY[]::TEXT[];

NOTIFY pgrst, 'reload schema';
