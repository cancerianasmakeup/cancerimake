// Tipos y constantes de site_settings. NO importa nada de server (next/headers,
// supabase-server). Esto permite que componentes "use client" puedan tipar las
// settings sin arrastrar dependencias de server.

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
