-- Hace las categorías 100% configurables desde el admin:
-- emoji/icono, gradiente (2 colores), descripción opcional.

ALTER TABLE categories
  ADD COLUMN IF NOT EXISTS icon TEXT NOT NULL DEFAULT '🌸',
  ADD COLUMN IF NOT EXISTS gradient_from TEXT NOT NULL DEFAULT '#FFB3C6',
  ADD COLUMN IF NOT EXISTS gradient_to TEXT NOT NULL DEFAULT '#FF8FA3',
  ADD COLUMN IF NOT EXISTS description TEXT;

-- Seed: ponerle look propio a las 5 categorías iniciales
UPDATE categories SET icon='💗', gradient_from='#FF8FA3', gradient_to='#E66B85' WHERE slug='lenceria';
UPDATE categories SET icon='🌸', gradient_from='#FFB3C6', gradient_to='#FF8FA3' WHERE slug='cosmetica';
UPDATE categories SET icon='✨', gradient_from='#FFE5EC', gradient_to='#FFB3C6' WHERE slug='accesorios';
UPDATE categories SET icon='🌿', gradient_from='#A8D5A8', gradient_to='#FFE5EC' WHERE slug='wellness';
UPDATE categories SET icon='🎀', gradient_from='#F4B4A0', gradient_to='#FF8FA3' WHERE slug='promos';

NOTIFY pgrst, 'reload schema';
