import { createSupabaseServer } from "./supabase-server";

export type BrandInfo = {
  name: string;
  tagline: string;
  logo_url: string;
  whatsapp: string;
  whatsapp_default_message: string;
  instagram_url: string;
  tiktok_url: string;
  contact_email: string;
  show_whatsapp_floating: boolean;
  show_instagram: boolean;
  show_tiktok: boolean;
};

export const DEFAULT_BRAND: BrandInfo = {
  name: "Cancerianas",
  tagline: "Para mujeres libres",
  logo_url: "https://pub-4cc128b92e8340509487ec06143abf2e.r2.dev/cancerianas/LOGO%20HOR%202.png",
  whatsapp: "",
  whatsapp_default_message: "¡Hola! Tengo una consulta sobre la tienda.",
  instagram_url: "https://instagram.com",
  tiktok_url: "https://tiktok.com",
  contact_email: "cancerianas.kids@gmail.com",
  show_whatsapp_floating: true,
  show_instagram: true,
  show_tiktok: true,
};

export type Analytics = {
  ga4_id: string;
  fb_pixel_id: string;
  tiktok_pixel_id: string;
};

export type Seo = {
  meta_title: string;
  meta_description: string;
  og_image_url: string;
  keywords: string;
};

export type Maintenance = {
  enabled: boolean;
  message: string;
  allow_admins: boolean;
};

export type ShippingExtras = {
  free_shipping_threshold: number;
  recargo_porcentaje: number;
  fee_fijo: number;
  note_for_customer: string;
};

/** Lee una key de site_settings desde el server (cacheable por Next). */
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
