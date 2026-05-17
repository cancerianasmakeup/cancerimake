-- ============================================================
-- Garantiza que el enum shipment_carrier tenga TODOS los valores
-- usados en el código: andreani, correo_argentino, personalizado.
--
-- Las migraciones 20260507000001 y 20260508000001 ya hicieron estos
-- ADD VALUE, pero si por algún motivo no se aplicaron en algún entorno
-- (re-importación, restore, etc), esta migración los garantiza de nuevo.
--
-- ALTER TYPE ... ADD VALUE IF NOT EXISTS es idempotente.
-- ============================================================

ALTER TYPE shipment_carrier ADD VALUE IF NOT EXISTS 'andreani';
ALTER TYPE shipment_carrier ADD VALUE IF NOT EXISTS 'correo_argentino';
ALTER TYPE shipment_carrier ADD VALUE IF NOT EXISTS 'personalizado';

-- Forzar refresh del schema cache de PostgREST para que la API
-- empiece a aceptar los valores nuevos sin necesidad de reiniciar.
NOTIFY pgrst, 'reload schema';
