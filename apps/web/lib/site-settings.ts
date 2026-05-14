// Server-only helpers para leer site_settings. NO importar desde componentes
// "use client" — pulla next/headers via supabase-server.
import "server-only";
import { createSupabaseServer } from "./supabase-server";
import {
  DEFAULT_BRAND,
  type BrandInfo,
  type Analytics,
  type Seo,
  type Maintenance,
  type ShippingExtras,
} from "./site-settings-types";

export * from "./site-settings-types";

/** Lee una key de site_settings desde el server. */
export async function getSetting<T>(key: string, fallback: T): Promise<T> {
  try {
    const supabase = await createSupabaseServer();
    const { data } = await supabase
      .from("site_settings")
      .select("value")
      .eq("key", key)
      .maybeSingle();
    if (!data?.value) return fallback;
    return { ...fallback, ...(data.value as Partial<T>) };
  } catch {
    return fallback;
  }
}

export const getBrandInfo  = () => getSetting<BrandInfo>("brand_info", DEFAULT_BRAND);
export const getAnalytics  = () => getSetting<Analytics>("analytics", { ga4_id: "", fb_pixel_id: "", tiktok_pixel_id: "" });
export const getSeo        = () => getSetting<Seo>("seo", { meta_title: "", meta_description: "", og_image_url: "", keywords: "" });
export const getMaintenance = () => getSetting<Maintenance>("maintenance", { enabled: false, message: "", allow_admins: true });
export const getShippingExtras = () => getSetting<ShippingExtras>("shipping_extras", { free_shipping_threshold: 0, recargo_porcentaje: 0, fee_fijo: 0, note_for_customer: "" });
