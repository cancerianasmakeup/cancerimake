"use client";

import Link from "next/link";
import { MapPin } from "lucide-react";

/**
 * Vuelve a la pantalla de elección de tienda, que vive en la raíz del dominio.
 * Sin esto, entrar a una tienda sería un camino de ida.
 */
export default function StoreSwitchLink({ className = "" }: { className?: string }) {
  return (
    <Link
      href="/"
      className={`inline-flex items-center gap-1 hover:text-rose-primary transition ${className}`}
    >
      <MapPin className="w-3 h-3" />
      Cambiar de tienda
    </Link>
  );
}
