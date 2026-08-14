import { HEADER_LOGOS, getDefaultStoreId, getStore } from "./stores";

// Igual que DEFAULT_BRAND: el nombre y el logo salen de la tienda que sirve
// este deploy. Fijarlos a mano hacía que Mar del Plata arrancara mostrando la
// marca de Buenos Aires hasta que respondía la base.
const TIENDA = getStore(getDefaultStoreId());

export const BRAND = {
  name: TIENDA?.name ?? "Cancerianas",
  tagline: "Para mujeres libres",
  logoUrl: HEADER_LOGOS[getDefaultStoreId()],
  whatsapp: "5491100000000", // cambiar
};
