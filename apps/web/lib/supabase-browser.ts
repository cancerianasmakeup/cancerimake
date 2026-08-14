"use client";

import { createBrowserClient } from "@supabase/ssr";

import { STORE_COOKIE, resolveStore, type StoreConfig } from "./stores";

/**
 * Lee la cookie de tienda desde el navegador.
 *
 * La cookie tiene path=/admin, así que document.cookie solo la ve estando en
 * una ruta del panel. En la tienda pública devuelve undefined y el cliente cae
 * a la tienda del deploy — que es exactamente lo que queremos.
 */
function readStoreCookie(): string | undefined {
  if (typeof document === "undefined") return undefined;
  const match = document.cookie.match(
    new RegExp(`(?:^|;\\s*)${STORE_COOKIE}=([^;]*)`)
  );
  return match ? decodeURIComponent(match[1]) : undefined;
}

export function createSupabaseBrowser() {
  const store = resolveStore(readStoreCookie());
  return createBrowserClient(store.supabaseUrl, store.anonKey);
}

/** La tienda que está viendo el navegador ahora mismo. */
export function getCurrentStoreClient(): StoreConfig {
  return resolveStore(readStoreCookie());
}
