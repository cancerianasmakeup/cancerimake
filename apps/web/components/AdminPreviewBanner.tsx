// Banner que se muestra arriba de todo cuando un admin navega la tienda
// que está cerrada para visitantes. Renderizado por StoreGate.

import Link from "next/link";
import { Eye, Settings } from "lucide-react";

export default function AdminPreviewBanner() {
  return (
    <div className="bg-gradient-to-r from-warning/90 via-warning to-warning/90 text-ink-primary text-xs sm:text-sm py-2 px-3 sm:px-4 text-center font-semibold border-b border-warning">
      <div className="max-w-6xl mx-auto flex items-center justify-center gap-3 flex-wrap">
        <span className="inline-flex items-center gap-2">
          <Eye className="w-4 h-4" />
          Vista previa admin · la tienda está CERRADA para visitantes
        </span>
        <Link
          href="/admin/store"
          className="inline-flex items-center gap-1 bg-ink-primary text-white px-3 py-1 rounded-full text-xs hover:bg-ink-secondary transition"
        >
          <Settings className="w-3 h-3" /> Configurar
        </Link>
      </div>
    </div>
  );
}
