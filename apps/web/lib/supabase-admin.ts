import { createClient } from "@supabase/supabase-js";

import { getDefaultStoreId, getStore, type StoreId } from "./stores";

// La service_role SÍ es secreta (bypassea RLS), así que nunca lleva el prefijo
// NEXT_PUBLIC_ y jamás llega al navegador. Una por tienda.
const SERVICE_ROLE: Record<StoreId, string | undefined> = {
  "buenos-aires": process.env.SUPABASE_SERVICE_ROLE_KEY,
  "mar-del-plata": process.env.SUPABASE_SERVICE_ROLE_KEY_MDP,
};

/**
 * Cliente con service_role para la tienda indicada. Solo server-side.
 *
 * A diferencia de createSupabaseServer(), acá la tienda se pasa explícita: los
 * route handlers viven bajo /api y no reciben la cookie de tienda (que está
 * scopeada a /admin), así que adivinarla sería un bug esperando pasar.
 */
export function createSupabaseAdmin(storeId: StoreId = getDefaultStoreId()) {
  const store = getStore(storeId);
  const serviceRole = SERVICE_ROLE[storeId];

  if (!store) {
    throw new Error(`La tienda "${storeId}" no está configurada en este deploy.`);
  }
  if (!serviceRole) {
    throw new Error(
      `Falta la service_role de "${storeId}". Definí ${
        storeId === "buenos-aires" ? "SUPABASE_SERVICE_ROLE_KEY" : "SUPABASE_SERVICE_ROLE_KEY_MDP"
      } en las variables de entorno del deploy.`
    );
  }

  return createClient(store.supabaseUrl, serviceRole, {
    auth: { persistSession: false },
  });
}
