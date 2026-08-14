// lib/stores.ts
// ============================================================
// REGISTRO DE TIENDAS
// ============================================================
// Cada tienda es un proyecto Supabase independiente: su propio stock, sus
// órdenes, sus clientas y su propia configuración. El código es el mismo para
// todas; lo único que cambia es contra qué base habla.
//
// Cómo se elige la tienda:
//   - Tienda pública  -> SIEMPRE la de NEXT_PUBLIC_DEFAULT_STORE (la del deploy).
//     cancerianas.com.ar muestra Buenos Aires y punto.
//   - Panel /admin    -> la que la admin haya elegido al entrar, guardada en una
//     cookie con path=/admin. Al estar scopeada a /admin, el navegador NO la manda
//     en las rutas públicas, así que no hay forma de que la tienda pública muestre
//     los datos de la otra.
//
// La anon key es pública por diseño (viaja al navegador en cualquier caso), así
// que no hay problema en que un deploy conozca la config pública de las dos.
// La service_role NO: esa es server-side y se resuelve aparte.

export type StoreId = "buenos-aires" | "mar-del-plata";

export type StoreConfig = {
  id: StoreId;
  /** Nombre completo, para títulos y mails. */
  name: string;
  /** Nombre corto, para el selector y el badge del admin. */
  shortName: string;
  supabaseUrl: string;
  anonKey: string;
  /** Dominio público de esta tienda, para los links del selector. */
  domain: string;
  logoUrl: string | null;
};

// Next.js reemplaza process.env.NEXT_PUBLIC_* en build time solo cuando el
// acceso es literal — nada de process.env[variable]. Por eso están escritas una
// por una en vez de armadas dinámicamente.
const RAW: Record<StoreId, { url?: string; anon?: string; domain?: string; logo?: string }> = {
  "buenos-aires": {
    url: process.env.NEXT_PUBLIC_SUPABASE_URL,
    anon: process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY,
    domain: process.env.NEXT_PUBLIC_STORE_BA_DOMAIN,
    logo: process.env.NEXT_PUBLIC_STORE_BA_LOGO,
  },
  "mar-del-plata": {
    url: process.env.NEXT_PUBLIC_SUPABASE_URL_MDP,
    anon: process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY_MDP,
    domain: process.env.NEXT_PUBLIC_STORE_MDP_DOMAIN,
    logo: process.env.NEXT_PUBLIC_STORE_MDP_LOGO,
  },
};

const LABELS: Record<StoreId, { name: string; shortName: string }> = {
  "buenos-aires": { name: "Cancerianas Buenos Aires", shortName: "Buenos Aires" },
  "mar-del-plata": { name: "Cancerianas Mar del Plata", shortName: "Mar del Plata" },
};

// Dominio público de cada tienda. cancerianasmakeup.com.ar es además el portal:
// muestra el selector de tiendas antes de entrar (ver isPortalDeploy).
const DEFAULT_DOMAINS: Record<StoreId, string> = {
  "buenos-aires": "cancerianasmakeup.com.ar",
  "mar-del-plata": "cancerianasmardelplata.com.ar",
};

// Logo HORIZONTAL de cada tienda: el que va en el menú/header.
// El header lo lee de site_settings.brand_info.logo_url de su propia base; esto
// es la referencia para sembrar esa fila cuando se crea una tienda nueva, y el
// respaldo si la base todavía no lo tiene cargado.
export const HEADER_LOGOS: Record<StoreId, string> = {
  "buenos-aires":
    "https://pub-4ee8d6afe02b441fa29b28b501f5a6be.r2.dev/LOGOSNUEVOS/optimizados/header-buenos-aires.webp",
  "mar-del-plata":
    "https://pub-4ee8d6afe02b441fa29b28b501f5a6be.r2.dev/LOGOSNUEVOS/optimizados/header-mar-del-plata.webp",
};

// Logos APILADOS del selector de tiendas, optimizados a WebP 800px (el original
// de Buenos Aires era un PNG de 5016x5016 y 12 MB). Se pueden pisar por env.
const DEFAULT_LOGOS: Record<StoreId, string> = {
  "buenos-aires":
    "https://pub-4ee8d6afe02b441fa29b28b501f5a6be.r2.dev/LOGOSNUEVOS/optimizados/cancerianas-buenos-aires-trazo.webp",
  "mar-del-plata":
    "https://pub-4ee8d6afe02b441fa29b28b501f5a6be.r2.dev/LOGOSNUEVOS/optimizados/cancerianas-mar-del-plata.webp",
};

export const STORE_IDS: StoreId[] = ["buenos-aires", "mar-del-plata"];

/**
 * Ruta de la home de Buenos Aires dentro del deploy que tiene el portal.
 * La raíz queda reservada para la pantalla de elección de tienda.
 */
export const BSAS_HOME_PATH = "/bsas";

/** Cookie donde vive la tienda elegida en el admin. */
export const STORE_COOKIE = "cx_admin_store";
/** Scope de la cookie: el navegador solo la manda bajo /admin. Es lo que aísla
 *  la tienda pública del selector. No cambiar sin entender esa consecuencia. */
export const STORE_COOKIE_PATH = "/admin";

function build(id: StoreId): StoreConfig | null {
  const raw = RAW[id];
  // Una tienda existe solo si tiene URL y anon key. Mientras Mar del Plata no
  // esté creada, el selector muestra una sola opción y todo sigue como hoy.
  if (!raw.url || !raw.anon) return null;
  return {
    id,
    name: LABELS[id].name,
    shortName: LABELS[id].shortName,
    supabaseUrl: raw.url,
    anonKey: raw.anon,
    domain: raw.domain ?? DEFAULT_DOMAINS[id],
    logoUrl: raw.logo ?? DEFAULT_LOGOS[id],
  };
}

/** Todas las tiendas que están efectivamente configuradas. */
export function getConfiguredStores(): StoreConfig[] {
  return STORE_IDS.map(build).filter((s): s is StoreConfig => s !== null);
}

export function getStore(id: StoreId): StoreConfig | null {
  return build(id);
}

export function isStoreId(value: unknown): value is StoreId {
  return typeof value === "string" && (STORE_IDS as string[]).includes(value);
}

/**
 * Si este deploy es el portal de entrada. En cancerianasmakeup.com.ar va en
 * true: su home muestra el selector de tiendas. En el deploy de Mar del Plata
 * va en false, porque quien entra ahí ya eligió tienda al escribir el dominio.
 */
export function isPortalDeploy(): boolean {
  return process.env.NEXT_PUBLIC_STORE_PORTAL === "true";
}

/**
 * Si este deploy muestra la pantalla de elección en la raíz.
 * Requiere estar marcado como portal Y tener más de una tienda cargada: con una
 * sola no hay nada que elegir y la home va en / como siempre.
 */
export function showsPortal(): boolean {
  return isPortalDeploy() && getConfiguredStores().length > 1;
}

/**
 * A dónde apunta "Inicio" y el logo del header.
 * En el deploy con portal la home de la tienda vive en /bsas, porque / es la
 * pantalla de elección: mandar ahí a la clienta la sacaría de la tienda.
 */
export function storeHomePath(): string {
  return showsPortal() ? BSAS_HOME_PATH : "/";
}

/** La tienda que sirve este deploy en su parte pública. */
export function getDefaultStoreId(): StoreId {
  const fromEnv = process.env.NEXT_PUBLIC_DEFAULT_STORE;
  return isStoreId(fromEnv) ? fromEnv : "buenos-aires";
}

/**
 * Resuelve la tienda a usar a partir del valor crudo de la cookie.
 * Si la cookie no existe, trae basura, o apunta a una tienda todavía no
 * configurada, cae a la tienda por defecto del deploy. Nunca devuelve null:
 * es preferible operar la tienda propia que romper el panel.
 */
export function resolveStore(cookieValue?: string | null): StoreConfig {
  if (isStoreId(cookieValue)) {
    const picked = build(cookieValue);
    if (picked) return picked;
  }
  const fallback = build(getDefaultStoreId());
  if (fallback) return fallback;

  // Sin ninguna tienda configurada no hay nada que hacer: es un deploy sin envs.
  throw new Error(
    "No hay ninguna tienda configurada. Falta definir NEXT_PUBLIC_SUPABASE_URL y NEXT_PUBLIC_SUPABASE_ANON_KEY."
  );
}
