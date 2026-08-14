import { createServerClient } from "@supabase/ssr";
import { cookies } from "next/headers";

import {
  STORE_COOKIE,
  getDefaultStoreId,
  getStore,
  isStoreId,
  resolveStore,
  type StoreConfig,
  type StoreId,
} from "./stores";

/**
 * Cliente de Supabase para server components.
 *
 * Bajo /admin devuelve la tienda que la admin eligió en el selector; en la
 * tienda pública devuelve siempre la del deploy, porque la cookie de tienda
 * tiene path=/admin y el navegador no la manda en las rutas públicas.
 *
 * Las cookies de sesión de Supabase se llaman sb-<project-ref>-auth-token, así
 * que las sesiones de las dos tiendas conviven en el navegador sin pisarse.
 */
export async function createSupabaseServer() {
  const cookieStore = await cookies();
  const store = resolveStore(cookieStore.get(STORE_COOKIE)?.value);

  return createServerClient(store.supabaseUrl, store.anonKey, {
    cookies: {
      getAll() {
        return cookieStore.getAll();
      },
      setAll(cookiesToSet: { name: string; value: string; options: Record<string, unknown> }[]) {
        try {
          cookiesToSet.forEach(({ name, value, options }) =>
            cookieStore.set(name, value, options)
          );
        } catch { /* server component readonly */ }
      },
    },
  });
}

/** La tienda contra la que está operando el request actual. */
export async function getCurrentStore(): Promise<StoreConfig> {
  const cookieStore = await cookies();
  return resolveStore(cookieStore.get(STORE_COOKIE)?.value);
}

/**
 * Cliente para una tienda puntual, ignorando la cookie.
 *
 * Es lo que necesitan los route handlers bajo /api: la cookie de tienda tiene
 * path=/admin y ahí no llega, así que la tienda se manda explícita en el header
 * x-store-id. Las cookies de sesión de Supabase sí viajan (van con path=/), de
 * modo que la sesión correcta se encuentra sola una vez elegido el proyecto.
 */
export async function createSupabaseServerForStore(storeId: StoreId) {
  const cookieStore = await cookies();
  const store = getStore(storeId);

  if (!store) {
    throw new Error(`La tienda "${storeId}" no está configurada en este deploy.`);
  }

  return createServerClient(store.supabaseUrl, store.anonKey, {
    cookies: {
      getAll() {
        return cookieStore.getAll();
      },
      setAll(cookiesToSet: { name: string; value: string; options: Record<string, unknown> }[]) {
        try {
          cookiesToSet.forEach(({ name, value, options }) =>
            cookieStore.set(name, value, options)
          );
        } catch { /* server component readonly */ }
      },
    },
  });
}

/** Lee la tienda del header x-store-id de un request. Cae a la del deploy. */
export function storeIdFromRequest(request: Request): StoreId {
  const header = request.headers.get("x-store-id");
  return isStoreId(header) ? header : getDefaultStoreId();
}
