-- ============================================================
-- GRANTS faltantes para service_role
-- ============================================================
-- La migration `20260504000003_grants.sql` cubrió `anon` y `authenticated` pero
-- olvidó `service_role`. Eso hace que las edge functions y los scripts admin
-- (todo lo que use SUPABASE_SERVICE_ROLE_KEY) reciban "permission denied" al
-- intentar leer/escribir en tablas públicas, aunque service_role debería
-- bypassear RLS.
--
-- Arreglo: dar permisos completos a service_role en todo el schema public.
-- service_role bypassea RLS por diseño, así que es seguro darle ALL.

GRANT ALL ON ALL TABLES IN SCHEMA public TO service_role;
GRANT ALL ON ALL SEQUENCES IN SCHEMA public TO service_role;
GRANT EXECUTE ON ALL FUNCTIONS IN SCHEMA public TO service_role;

-- Para tablas/secuencias/funciones que se creen en el futuro
ALTER DEFAULT PRIVILEGES IN SCHEMA public
  GRANT ALL ON TABLES TO service_role;
ALTER DEFAULT PRIVILEGES IN SCHEMA public
  GRANT ALL ON SEQUENCES TO service_role;
ALTER DEFAULT PRIVILEGES IN SCHEMA public
  GRANT EXECUTE ON FUNCTIONS TO service_role;

NOTIFY pgrst, 'reload schema';
