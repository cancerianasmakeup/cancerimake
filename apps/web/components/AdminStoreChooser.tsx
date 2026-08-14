"use client";

import { useRouter } from "next/navigation";
import { useState } from "react";
import { Store as StoreIcon } from "lucide-react";

import { STORE_COOKIE, STORE_COOKIE_PATH, type StoreConfig, type StoreId } from "@/lib/stores";

// Un año. La elección persiste entre sesiones: la admin no tiene que volver a
// elegir cada vez que entra.
const MAX_AGE = 60 * 60 * 24 * 365;

export function selectStore(id: StoreId) {
  document.cookie = `${STORE_COOKIE}=${encodeURIComponent(id)}; path=${STORE_COOKIE_PATH}; max-age=${MAX_AGE}; samesite=lax`;
}

export default function AdminStoreChooser({ stores }: { stores: StoreConfig[] }) {
  const router = useRouter();
  const [pending, setPending] = useState<StoreId | null>(null);

  function pick(id: StoreId) {
    setPending(id);
    selectStore(id);
    // Re-ejecuta los server components del panel: a partir de acá todo el admin
    // habla con la base de la tienda elegida.
    router.refresh();
  }

  return (
    <div className="min-h-screen flex items-center justify-center px-4 py-10">
      <div className="w-full max-w-2xl text-center">
        <h1 className="font-display text-3xl text-ink-primary">¿En qué tienda vas a trabajar?</h1>
        <p className="text-ink-secondary mt-2 mb-8">
          Cada tienda tiene su propio stock, sus órdenes y su configuración. Podés cambiar cuando
          quieras desde el panel.
        </p>

        <div className="grid gap-4 sm:grid-cols-2">
          {stores.map((store) => (
            <button
              key={store.id}
              type="button"
              onClick={() => pick(store.id)}
              disabled={pending !== null}
              className="card flex flex-col items-center gap-4 p-8 transition hover:border-rose-deep hover:shadow-lg disabled:opacity-60"
            >
              {store.logoUrl ? (
                // eslint-disable-next-line @next/next/no-img-element
                <img
                  src={store.logoUrl}
                  alt={store.name}
                  className="h-16 w-auto object-contain"
                />
              ) : (
                <StoreIcon className="w-12 h-12 text-rose-deep" />
              )}
              <div>
                <div className="font-display text-xl text-ink-primary">{store.shortName}</div>
                {store.domain && (
                  <div className="text-xs text-ink-soft mt-1">{store.domain}</div>
                )}
              </div>
              <span className="text-sm font-medium text-rose-deep">
                {pending === store.id ? "Entrando…" : "Trabajar acá"}
              </span>
            </button>
          ))}
        </div>
      </div>
    </div>
  );
}
