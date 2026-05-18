"use client";

import { useEffect } from "react";

export default function PrintTrigger() {
  useEffect(() => {
    const t = setTimeout(() => window.print(), 300);
    return () => clearTimeout(t);
  }, []);

  return (
    <div className="flex justify-end gap-2 mb-4 print:hidden">
      <button
        onClick={() => window.print()}
        className="px-4 py-2 rounded-full bg-rose-deep text-white font-semibold text-sm hover:bg-rose-deep/90"
      >
        Imprimir de nuevo
      </button>
    </div>
  );
}
