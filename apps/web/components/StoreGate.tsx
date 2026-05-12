// Server component que envuelve cualquier página de la tienda.
// Si la tienda está cerrada y el usuario no es admin, devuelve la landing exclusiva.
// Los admins pueden navegar normalmente con un banner que avisa la tienda está cerrada
// para visitantes (vista previa).

import { getServerStoreState, isCurrentUserAdmin } from "@/lib/store-status";
import StoreClosedLanding from "./StoreClosedLanding";
import AdminPreviewBanner from "./AdminPreviewBanner";

export default async function StoreGate({ children }: { children: React.ReactNode }) {
  const [{ config, status }, isAdmin] = await Promise.all([
    getServerStoreState(),
    isCurrentUserAdmin(),
  ]);

  if (!status.isOpen && !isAdmin) {
    return <StoreClosedLanding config={config} />;
  }

  // Admin con tienda cerrada → banner de preview + páginas normales
  if (!status.isOpen && isAdmin) {
    return (
      <>
        <AdminPreviewBanner />
        {children}
      </>
    );
  }

  return <>{children}</>;
}
