// Helper server-side: lee site_settings.store_status y devuelve config + status calculado.
// Se usa en layouts/pages para gatear el catálogo cuando la tienda está cerrada.

import { createSupabaseServer } from "./supabase-server";
import {
  DEFAULT_STORE_STATUS,
  getStoreStatus,
  type StoreStatusConfig,
  type StoreStatusResult,
} from "@cancerianas/shared";

export interface StoreState {
  config: StoreStatusConfig;
  status: StoreStatusResult;
}

/** Lee la config de tienda de Supabase (server). Cachea por request. */
export async function getServerStoreState(): Promise<StoreState> {
  try {
    const supabase = await createSupabaseServer();
    const { data } = await supabase
      .from("site_settings")
      .select("value")
      .eq("key", "store_status")
      .maybeSingle();

    const config: StoreStatusConfig = {
      ...DEFAULT_STORE_STATUS,
      ...((data?.value as Partial<StoreStatusConfig>) ?? {}),
    };
    const status = getStoreStatus(config);
    return { config, status };
  } catch {
    return {
      config: DEFAULT_STORE_STATUS,
      status: getStoreStatus(DEFAULT_STORE_STATUS),
    };
  }
}

/** Verifica si el usuario actual es admin (los admins pueden navegar igual con la tienda cerrada). */
export async function isCurrentUserAdmin(): Promise<boolean> {
  try {
    const supabase = await createSupabaseServer();
    const {
      data: { user },
    } = await supabase.auth.getUser();
    if (!user) return false;
    const { data: profile } = await supabase
      .from("profiles")
      .select("role")
      .eq("id", user.id)
      .maybeSingle();
    return profile?.role === "admin";
  } catch {
    return false;
  }
}
