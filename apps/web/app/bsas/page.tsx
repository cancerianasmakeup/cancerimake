import StoreHome from "@/components/StoreHome";

// Tienda de oportunidades: el estado depende del momento → NO cachear el HTML
export const dynamic = "force-dynamic";

/**
 * Home de Cancerianas Buenos Aires.
 *
 * Vive acá y no en la raíz porque en este deploy la raíz es la pantalla de
 * elección de tienda. El resto de la tienda (/shop, /product/…, /checkout)
 * sigue colgando de la raíz: moverla entera bajo /bsas rompería todos los
 * links que ya circulan, sin ganar nada.
 */
export default async function BsAsHomePage() {
  return <StoreHome />;
}
