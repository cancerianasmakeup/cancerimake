"use client";

import { useRouter } from "next/navigation";
import { useState } from "react";
import { Check, ChevronDown, Store as StoreIcon } from "lucide-react";

import type { StoreConfig, StoreId } from "@/lib/stores";
import { selectStore } from "./AdminStoreChooser";

/**
 * Muestra en qué tienda estás trabajando y permite saltar a la otra.
 * Si solo hay una tienda configurada no se renderiza nada.
 */
export default function AdminStoreSwitcher({
  current,
  stores,
}: {
  current: StoreConfig;
  stores: StoreConfig[];
}) {
  const router = useRouter();
  const [open, setOpen] = useState(false);

  if (stores.length < 2) return null;

  function switchTo(id: StoreId) {
    setOpen(false);
    if (id === current.id) return;
    selectStore(id);
    router.refresh();
  }

  return (
    <div className="relative">
      <button
        type="button"
        onClick={() => setOpen((v) => !v)}
        className="w-full flex items-center gap-2 px-3 py-2 rounded-2xl bg-rose-pastel/60 text-left hover:bg-rose-pastel transition"
      >
        <StoreIcon className="w-4 h-4 text-rose-deep flex-shrink-0" />
        <span className="flex-1 min-w-0">
          <span className="block text-[11px] uppercase tracking-wide text-ink-soft">Trabajando en</span>
          <span className="block text-sm font-medium text-ink-primary truncate">
            {current.shortName}
          </span>
        </span>
        <ChevronDown
          className={`w-4 h-4 text-ink-soft transition ${open ? "rotate-180" : ""}`}
        />
      </button>

      {open && (
        <div className="absolute z-40 left-0 right-0 mt-1 rounded-2xl border border-rose-pastel bg-white shadow-lg overflow-hidden">
          {stores.map((store) => (
            <button
              key={store.id}
              type="button"
              onClick={() => switchTo(store.id)}
              className="w-full flex items-center gap-2 px-3 py-2.5 text-left text-sm hover:bg-rose-pastel/60 transition"
            >
              <span className="flex-1 min-w-0 truncate text-ink-primary">{store.shortName}</span>
              {store.id === current.id && (
                <Check className="w-4 h-4 text-rose-deep flex-shrink-0" />
              )}
            </button>
          ))}
        </div>
      )}
    </div>
  );
}
