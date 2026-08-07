"use client";

import { useState, useEffect, useMemo, useCallback } from "react";
import { Remito, RemitItem } from "@/types/remito";
import {
  Trash2,
  Download,
  Edit2,
  Check,
  X,
  UserPlus,
  Loader2,
  Tag,
  ShoppingBag,
  PencilLine,
} from "lucide-react";
import ProductPicker from "./ProductPicker";
import { formatPriceARG, unitPriceFor, useCatalog } from "@/lib/remito-catalog";
import type { CatalogProduct } from "@/lib/remito-catalog";

interface LiveRemito extends Remito {
  tempId: string;
}

// Próximo número de cliente: máximo "Cliente N" existente + 1
function nextClientNumber(list: LiveRemito[]): number {
  let max = 0;
  for (const r of list) {
    const m = r.clientName.match(/^cliente\s+(\d+)$/i);
    if (m) max = Math.max(max, parseInt(m[1], 10));
  }
  return max + 1;
}

export default function MultipleRemitosLive() {
  const [remitos, setRemitos] = useState<LiveRemito[]>([]);
  const [isLoaded, setIsLoaded] = useState(false);
  const { catalog, catalogState } = useCatalog();

  useEffect(() => {
    const saved = localStorage.getItem("liveRemitos");
    if (saved) {
      setRemitos(JSON.parse(saved));
    }
    setIsLoaded(true);
  }, []);

  useEffect(() => {
    if (isLoaded) {
      localStorage.setItem("liveRemitos", JSON.stringify(remitos));
    }
  }, [remitos, isLoaded]);

  // Unidades ya cargadas de cada producto en TODOS los remitos de la sesión
  // (para que entre todos los remitos no se venda más que el stock real).
  const reserved = useMemo(() => {
    const m = new Map<string, number>();
    for (const r of remitos) {
      for (const it of r.items) {
        if (it.productId) m.set(it.productId, (m.get(it.productId) ?? 0) + it.quantity);
      }
    }
    return m;
  }, [remitos]);

  const addNewRemito = () => {
    const n = nextClientNumber(remitos);
    const newRemito: LiveRemito = {
      id: `remito-${Date.now()}-${Math.random()}`,
      tempId: `live-${Date.now()}-${Math.random().toString(36).slice(2, 7)}`,
      createdAt: new Date().toISOString(),
      clientName: `Cliente ${n}`,
      clientEmail: "",
      clientPhone: "",
      items: [],
      notes: "",
      deposit: 0,
      status: "draft",
    };
    setRemitos([...remitos, newRemito]);
  };

  const updateClientContact = (tempId: string, newEmail: string, newPhone: string) => {
    setRemitos(
      remitos.map((r) =>
        r.tempId === tempId ? { ...r, clientEmail: newEmail, clientPhone: newPhone } : r
      )
    );
  };

  const updateClientName = (tempId: string, newName: string) => {
    setRemitos(
      remitos.map((r) => (r.tempId === tempId ? { ...r, clientName: newName } : r))
    );
  };

  const updateDeposit = (tempId: string, deposit: number) => {
    setRemitos(
      remitos.map((r) => (r.tempId === tempId ? { ...r, deposit } : r))
    );
  };

  const deleteRemito = (tempId: string) => {
    setRemitos(remitos.filter((r) => r.tempId !== tempId));
  };

  const addItemToRemito = useCallback(
    (tempId: string, item: Omit<RemitItem, "id">) => {
      setRemitos((prev) =>
        prev.map((r) => {
          if (r.tempId !== tempId) return r;

          // Si el producto ya está en el remito, fusionamos en una sola línea
          // y recalculamos el precio unitario según la CANTIDAD TOTAL: así el
          // mayorista se aplica aunque las unidades se sumen en tandas.
          if (item.productId) {
            const existing = r.items.find((i) => i.productId === item.productId);
            if (existing) {
              const totalQty = existing.quantity + item.quantity;
              const prod = catalog.find((p) => p.id === item.productId);
              const pricing = prod ? unitPriceFor(prod, totalQty) : null;
              return {
                ...r,
                items: r.items.map((i) =>
                  i.id === existing.id
                    ? {
                        ...i,
                        quantity: totalQty,
                        price: pricing ? pricing.unit : i.price,
                        wholesale: pricing ? pricing.wholesale : i.wholesale,
                      }
                    : i
                ),
              };
            }
          }

          return {
            ...r,
            items: [
              ...r.items,
              { id: `item-${Date.now()}-${Math.random().toString(36).slice(2, 7)}`, ...item },
            ],
          };
        })
      );
    },
    [catalog]
  );

  const removeItemFromRemito = (tempId: string, itemId: string) => {
    setRemitos(
      remitos.map((r) =>
        r.tempId === tempId ? { ...r, items: r.items.filter((i) => i.id !== itemId) } : r
      )
    );
  };

  const downloadAllRemitos = async () => {
    for (const remito of remitos) {
      if (remito.items.length > 0) {
        const { generateRemitoPDF } = await import("@/lib/remito-pdf");
        generateRemitoPDF(remito);
        // Pequeño delay entre descargas
        await new Promise((r) => setTimeout(r, 500));
      }
    }
  };

  const totalItems = remitos.reduce((s, r) => s + r.items.reduce((a, i) => a + i.quantity, 0), 0);
  const totalVendido = remitos.reduce(
    (s, r) => s + r.items.reduce((a, i) => a + i.quantity * i.price, 0),
    0
  );

  return (
    <div className="min-h-screen bg-gradient-to-br from-rose-whisper via-white to-rose-pastel p-4 sm:p-6">
      <div className="max-w-7xl mx-auto">
        {/* Header */}
        <div className="bg-white/80 backdrop-blur rounded-3xl shadow-soft border border-rose-pastel p-6 sm:p-8 mb-6">
          <div className="flex flex-wrap items-center justify-between gap-4">
            <div>
              <div className="flex items-center gap-3 mb-1">
                <span className="badge-live">En vivo</span>
                {catalogState === "loading" && (
                  <span className="inline-flex items-center gap-1.5 text-xs text-ink-soft">
                    <Loader2 className="w-3.5 h-3.5 animate-spin" /> Cargando catálogo…
                  </span>
                )}
                {catalogState === "ready" && (
                  <span className="text-xs text-ink-soft">
                    {catalog.length} productos de la tienda listos
                  </span>
                )}
                {catalogState === "error" && (
                  <span className="text-xs text-error font-semibold">
                    No se pudo cargar el catálogo — podés cargar items manuales
                  </span>
                )}
              </div>
              <h1 className="font-display text-3xl sm:text-4xl font-bold text-ink-primary">
                Remitos en vivo
              </h1>
              <p className="text-ink-secondary text-sm mt-1">
                Un remito por clienta · stock y precios reales de la tienda
              </p>
            </div>

            <div className="flex items-center gap-3 flex-wrap">
              {/* Stats */}
              {remitos.length > 0 && (
                <div className="hidden sm:flex items-center gap-2">
                  <div className="bg-rose-whisper rounded-2xl px-4 py-2 text-center">
                    <p className="text-lg font-bold text-rose-deep leading-none">{remitos.length}</p>
                    <p className="text-[10px] uppercase tracking-wider text-ink-soft mt-1">Remitos</p>
                  </div>
                  <div className="bg-rose-whisper rounded-2xl px-4 py-2 text-center">
                    <p className="text-lg font-bold text-rose-deep leading-none">{totalItems}</p>
                    <p className="text-[10px] uppercase tracking-wider text-ink-soft mt-1">Unidades</p>
                  </div>
                  <div className="bg-rose-whisper rounded-2xl px-4 py-2 text-center">
                    <p className="text-lg font-bold text-rose-deep leading-none">
                      {formatPriceARG(totalVendido)}
                    </p>
                    <p className="text-[10px] uppercase tracking-wider text-ink-soft mt-1">Vendido</p>
                  </div>
                </div>
              )}

              <button onClick={addNewRemito} className="btn-primary !py-2.5">
                <UserPlus className="w-4 h-4" /> Agregar cliente
              </button>
              {remitos.some((r) => r.items.length > 0) && (
                <button
                  onClick={downloadAllRemitos}
                  className="btn-secondary !py-2.5 !border-success !text-ink-primary hover:!bg-success/20"
                >
                  <Download className="w-4 h-4" /> Descargar todos (
                  {remitos.filter((r) => r.items.length > 0).length})
                </button>
              )}
            </div>
          </div>
        </div>

        {/* Grid de remitos */}
        {remitos.length > 0 && (
          <div className="grid grid-cols-1 xl:grid-cols-2 gap-6">
            {remitos.map((remito) => (
              <RemitCard
                key={remito.tempId}
                remito={remito}
                catalog={catalog}
                reserved={reserved}
                onAddItem={addItemToRemito}
                onRemoveItem={removeItemFromRemito}
                onDelete={deleteRemito}
                onUpdateClientName={updateClientName}
                onUpdateClientContact={updateClientContact}
                onUpdateDeposit={updateDeposit}
              />
            ))}
          </div>
        )}

        {remitos.length === 0 && isLoaded && (
          <div className="text-center py-20 bg-white/80 backdrop-blur rounded-3xl shadow-soft border border-rose-pastel">
            <div className="w-16 h-16 mx-auto mb-4 rounded-full bg-rose-whisper flex items-center justify-center">
              <ShoppingBag className="w-7 h-7 text-rose-deep" />
            </div>
            <p className="text-ink-primary font-semibold text-lg mb-1">Todavía no hay remitos</p>
            <p className="text-ink-soft text-sm mb-6">
              Agregá una clienta y empezá a cargar productos de la tienda.
            </p>
            <button onClick={addNewRemito} className="btn-primary">
              <UserPlus className="w-4 h-4" /> Agregar cliente
            </button>
          </div>
        )}
      </div>
    </div>
  );
}

// ============================================================
// Card de remito individual
// ============================================================

interface RemitCardProps {
  remito: LiveRemito;
  catalog: CatalogProduct[];
  reserved: Map<string, number>;
  onAddItem: (tempId: string, item: Omit<RemitItem, "id">) => void;
  onRemoveItem: (tempId: string, itemId: string) => void;
  onDelete: (tempId: string) => void;
  onUpdateClientName: (tempId: string, newName: string) => void;
  onUpdateClientContact: (tempId: string, newEmail: string, newPhone: string) => void;
  onUpdateDeposit: (tempId: string, deposit: number) => void;
}

function RemitCard({
  remito,
  catalog,
  reserved,
  onAddItem,
  onRemoveItem,
  onDelete,
  onUpdateClientName,
  onUpdateClientContact,
  onUpdateDeposit,
}: RemitCardProps) {
  const [isEditingName, setIsEditingName] = useState(false);
  const [editedName, setEditedName] = useState(remito.clientName);
  const [isEditingContact, setIsEditingContact] = useState(false);
  const [editedEmail, setEditedEmail] = useState(remito.clientEmail || "");
  const [editedPhone, setEditedPhone] = useState(remito.clientPhone || "");
  const [depositInput, setDepositInput] = useState<string>(
    remito.deposit > 0 ? String(remito.deposit) : ""
  );

  const subtotal = remito.items.reduce((sum, item) => sum + item.quantity * item.price, 0);
  const depositNum = remito.deposit || 0;
  const total = Math.max(subtotal - depositNum, 0);

  const commitDeposit = () => {
    const normalized = (depositInput || "").replace(/[^0-9,\.]/g, "").replace(/\./g, "").replace(/,/g, ".");
    const num = Math.max(0, parseFloat(normalized) || 0);
    onUpdateDeposit(remito.tempId, num);
    setDepositInput(num > 0 ? String(num) : "");
  };

  return (
    <div className="bg-white rounded-3xl shadow-soft border border-rose-pastel overflow-hidden hover:shadow-lift transition-shadow">
      {/* Header card */}
      <div className="bg-gradient-to-r from-rose-primary to-rose-deep text-white px-5 py-4">
        <div className="flex items-center justify-between gap-3">
          {isEditingName ? (
            <div className="flex gap-2 items-center flex-1">
              <input
                type="text"
                value={editedName}
                onChange={(e) => setEditedName(e.target.value)}
                onKeyDown={(e) => {
                  if (e.key === "Enter" && editedName.trim()) {
                    onUpdateClientName(remito.tempId, editedName.trim());
                    setIsEditingName(false);
                  }
                  if (e.key === "Escape") {
                    setEditedName(remito.clientName);
                    setIsEditingName(false);
                  }
                }}
                className="flex-1 px-3 py-1.5 rounded-xl text-ink-primary font-bold text-sm focus:outline-none"
                autoFocus
              />
              <button
                onClick={() => {
                  if (editedName.trim()) {
                    onUpdateClientName(remito.tempId, editedName.trim());
                    setIsEditingName(false);
                  }
                }}
                className="bg-white/90 hover:bg-white p-1.5 rounded-full text-green-600 transition"
              >
                <Check size={15} />
              </button>
              <button
                onClick={() => {
                  setEditedName(remito.clientName);
                  setIsEditingName(false);
                }}
                className="bg-white/90 hover:bg-white p-1.5 rounded-full text-red-500 transition"
              >
                <X size={15} />
              </button>
            </div>
          ) : (
            <button
              className="flex items-center gap-2 min-w-0 hover:opacity-85 transition text-left"
              onClick={() => {
                setEditedName(remito.clientName);
                setIsEditingName(true);
              }}
              title="Editar nombre"
            >
              <h3 className="font-bold text-lg truncate">{remito.clientName}</h3>
              <Edit2 size={13} className="opacity-70 flex-shrink-0" />
            </button>
          )}

          <div className="flex items-center gap-1.5 flex-shrink-0">
            <button
              onClick={() => setIsEditingContact((v) => !v)}
              className="bg-white/15 hover:bg-white/25 p-1.5 rounded-full transition"
              title="Email y teléfono"
            >
              <PencilLine size={14} />
            </button>
            <button
              onClick={() => onDelete(remito.tempId)}
              className="bg-white/15 hover:bg-red-500 p-1.5 rounded-full transition"
              title="Eliminar remito"
            >
              <Trash2 size={14} />
            </button>
          </div>
        </div>

        {/* Contacto (colapsable) */}
        {isEditingContact && (
          <div className="mt-3 grid grid-cols-1 sm:grid-cols-[1fr_1fr_auto] gap-2">
            <input
              className="px-3 py-1.5 rounded-xl text-xs text-ink-primary focus:outline-none"
              placeholder="Email (opcional)"
              value={editedEmail}
              onChange={(e) => setEditedEmail(e.target.value)}
            />
            <input
              className="px-3 py-1.5 rounded-xl text-xs text-ink-primary focus:outline-none"
              placeholder="Teléfono (opcional)"
              value={editedPhone}
              onChange={(e) => setEditedPhone(e.target.value)}
            />
            <button
              onClick={() => {
                onUpdateClientContact(remito.tempId, editedEmail.trim(), editedPhone.trim());
                setIsEditingContact(false);
              }}
              className="bg-white/90 hover:bg-white px-3 py-1.5 rounded-xl text-xs font-semibold text-rose-deep transition"
            >
              Guardar
            </button>
          </div>
        )}
        {!isEditingContact && (remito.clientEmail || remito.clientPhone) && (
          <p className="text-[11px] opacity-80 mt-1 truncate">
            {[remito.clientEmail, remito.clientPhone].filter(Boolean).join(" · ")}
          </p>
        )}
      </div>

      {/* Contenido */}
      <div className="p-4 sm:p-5">
        {/* Picker de productos de la tienda */}
        <ProductPicker
          catalog={catalog}
          reserved={reserved}
          remitoItems={remito.items}
          onAdd={(item) => onAddItem(remito.tempId, item)}
        />

        {/* Items */}
        <div className="mt-4 mb-4 max-h-56 overflow-y-auto">
          {remito.items.length === 0 ? (
            <p className="text-center text-ink-soft text-sm py-5">
              Sin productos todavía — buscá arriba ☝️
            </p>
          ) : (
            <div className="space-y-1.5">
              {remito.items.map((item) => (
                <div
                  key={item.id}
                  className="flex justify-between items-center gap-2 text-sm px-3 py-2 bg-rose-whisper rounded-2xl"
                >
                  <div className="flex-1 min-w-0">
                    <p className="font-semibold text-ink-primary text-xs truncate flex items-center gap-1.5">
                      {item.product}
                      {item.wholesale && (
                        <span className="inline-flex items-center gap-0.5 flex-shrink-0 bg-rose-deep text-white text-[9px] font-bold uppercase tracking-wide px-1.5 py-0.5 rounded-full">
                          <Tag size={8} /> Mayorista
                        </span>
                      )}
                    </p>
                    <p className="text-ink-soft text-xs">
                      {item.quantity} × {formatPriceARG(item.price)}
                    </p>
                  </div>
                  <p className="font-bold text-ink-primary text-xs whitespace-nowrap">
                    {formatPriceARG(item.quantity * item.price)}
                  </p>
                  <button
                    onClick={() => onRemoveItem(remito.tempId, item.id)}
                    className="text-ink-soft hover:text-error transition p-1"
                  >
                    <Trash2 size={14} />
                  </button>
                </div>
              ))}
            </div>
          )}
        </div>

        {/* Seña / Adelanto */}
        <div className="mb-3 flex items-center gap-2 px-3 py-2 bg-amber-50 rounded-2xl border border-amber-200">
          <label className="text-xs font-semibold text-amber-800 whitespace-nowrap">
            Seña:
          </label>
          <input
            type="text"
            inputMode="decimal"
            value={depositInput}
            onFocus={(e) => e.target.select()}
            onChange={(e) => setDepositInput(e.target.value)}
            onBlur={commitDeposit}
            onKeyDown={(e) => e.key === "Enter" && (e.target as HTMLInputElement).blur()}
            className="flex-1 px-2 py-1 text-xs bg-white border border-amber-200 rounded-xl text-right focus:outline-none focus:border-amber-400"
            placeholder="$ 0"
          />
          {depositNum > 0 && (
            <span className="text-xs font-bold text-amber-700 whitespace-nowrap">
              −{formatPriceARG(depositNum)}
            </span>
          )}
        </div>

        {/* Totales */}
        <div className="bg-gradient-to-r from-rose-primary to-rose-deep text-white px-4 py-3 rounded-2xl text-sm">
          <div className="flex justify-between items-center text-xs opacity-90">
            <span>Subtotal</span>
            <span className="font-semibold">{formatPriceARG(subtotal)}</span>
          </div>
          {depositNum > 0 && (
            <div className="flex justify-between items-center text-xs opacity-90 mt-1">
              <span>Seña</span>
              <span className="font-semibold">−{formatPriceARG(depositNum)}</span>
            </div>
          )}
          <div className="flex justify-between items-center mt-1.5 pt-1.5 border-t border-white/30">
            <span className="font-bold">TOTAL</span>
            <span className="font-bold text-lg">{formatPriceARG(total)}</span>
          </div>
        </div>

        {/* Botón descargar individual */}
        {remito.items.length > 0 && (
          <button
            onClick={async () => {
              const { generateRemitoPDF } = await import("@/lib/remito-pdf");
              generateRemitoPDF(remito);
            }}
            className="w-full mt-3 btn-secondary !py-2 !text-sm"
          >
            <Download size={15} /> Descargar PDF
          </button>
        )}
      </div>
    </div>
  );
}
