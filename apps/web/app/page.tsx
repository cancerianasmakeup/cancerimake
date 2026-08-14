import StoreHome from "@/components/StoreHome";
import StorePortal from "@/components/StorePortal";
import { getConfiguredStores, getDefaultStoreId, showsPortal } from "@/lib/stores";

// Tienda de oportunidades: el estado depende del momento → NO cachear el HTML
export const dynamic = "force-dynamic";

/**
 * La raíz del dominio.
 *
 * En cancerianasmakeup.com.ar (el deploy portal) es SIEMPRE la pantalla de
 * elección de tienda: Buenos Aires entra a /bsas, Mar del Plata se va a su
 * propio dominio.
 *
 * En el deploy de una sola tienda (cancerianasmardelplata.com.ar) la raíz es
 * la home de esa tienda, porque quien escribió ese dominio ya eligió.
 */
export default async function RootPage() {
  if (showsPortal()) {
    return (
      <StorePortal stores={getConfiguredStores()} localStoreId={getDefaultStoreId()} />
    );
  }
  return <StoreHome />;
}
