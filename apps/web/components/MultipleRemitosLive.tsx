"use client";

import { useState, useEffect, useMemo, useRef, useCallback } from "react";
import { Remito, RemitItem } from "@/types/remito";
import {
  Trash2,
  Plus,
  Minus,
  Download,
  Edit2,
  Check,
  X,
  Search,
  UserPlus,
  Loader2,
  Tag,
  ShoppingBag,
  PencilLine,
} from "lucide-react";
import { createSupabaseBrowser } from "@/lib/supabase-browser";
import { sanitizeWholesaleTiers, wholesaleTierInfo } from "@cancerianas/shared";
import type { WholesaleTier } from "@cancerianas/shared";

// Función para formatear precio con separador de miles y moneda argentina
function formatPriceARG(price: number): string {
  return new Intl.NumberFormat("es-AR", {
    style: "currency",
    currency: "ARS",
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  }).format(price);
}

// Normaliza texto para búsqueda (minúsculas, sin tildes)
function normalize(s: string): string {
  return s
    .toLowerCase()
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "");
}

interface LiveRemito extends Remito {
  tempId: string;
}

// Producto del catálogo real de la tienda (cargado 1 sola vez desde la DB)
interface CatalogProduct {
  id: string;
  name: string;
  price: number;
  stock: number;
  image: string | null;
  tiers: WholesaleTier[];
}

// Precio unitario a aplicar según cantidad: si alcanza un tier mayorista,
// usa el del tier más grande que entre en la cantidad. El cálculo del precio
// unitario vive en wholesaleTierInfo (shared), que soporta tiers cargados
// como total del pack O como precio por unidad.
function unitPriceFor(p: CatalogProduct, qty: number) {
  let tier: WholesaleTier | null = null;
  for (const t of p.tiers) {
    if (qty >= t.units) tier = t; // tiers vienen ordenados por units asc
  }
  if (tier) {
    const info = wholesaleTierInfo(tier, p.price);
    return { unit: info.unitPrice, wholesale: true, tier, discountPct: info.discountPct };
  }
  return { unit: p.price, wholesale: false, tier: null, discountPct: 0 };
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
  const [catalog, setCatalog] = useState<CatalogProduct[]>([]);
  const [catalogState, setCatalogState] = useState<"loading" | "ready" | "error">("loading");

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

  // Catálogo real de la tienda: nombre, precio, stock y packs mayoristas.
  useEffect(() => {
    const supabase = createSupabaseBrowser();
    supabase
      .from("products")
      .select("id, name, price, stock, images, wholesale_tiers")
      .eq("status", "active")
      .order("name")
      .then(({ data, error }) => {
        if (error) {
          console.error("Error cargando catálogo:", error);
          setCatalogState("error");
          return;
        }
        setCatalog(
          (data ?? []).map((p: any) => ({
            id: p.id,
            name: p.name,
            price: Number(p.price) || 0,
            stock: Math.max(0, Math.floor(Number(p.stock) || 0)),
            image: Array.isArray(p.images) && p.images.length > 0 ? p.images[0] : null,
            tiers: sanitizeWholesaleTiers(p.wholesale_tiers),
          }))
        );
        setCatalogState("ready");
      });
  }, []);

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

// ============================================================
// Picker de productos: busca en el catálogo real, respeta stock
// y aplica precio mayorista automáticamente.
// ============================================================

function ProductPicker({
  catalog,
  reserved,
  remitoItems,
  onAdd,
}: {
  catalog: CatalogProduct[];
  reserved: Map<string, number>;
  remitoItems: RemitItem[];
  onAdd: (item: Omit<RemitItem, "id">) => void;
}) {
  const [query, setQuery] = useState("");
  const [open, setOpen] = useState(false);
  const [highlight, setHighlight] = useState(0);
  const [selected, setSelected] = useState<CatalogProduct | null>(null);
  const [qty, setQty] = useState(1);
  const [manualMode, setManualMode] = useState(false);
  const [manualPrice, setManualPrice] = useState("");
  const searchRef = useRef<HTMLInputElement>(null);
  const qtyRef = useRef<HTMLInputElement>(null);

  const availableFor = useCallback(
    (p: CatalogProduct) => Math.max(0, p.stock - (reserved.get(p.id) ?? 0)),
    [reserved]
  );

  const results = useMemo(() => {
    const q = normalize(query.trim());
    if (!q) return [];
    return catalog.filter((p) => normalize(p.name).includes(q)).slice(0, 8);
  }, [catalog, query]);

  const selectProduct = (p: CatalogProduct) => {
    if (availableFor(p) <= 0) return;
    setSelected(p);
    setQuery(p.name);
    setOpen(false);
    setQty(1);
    // Foco directo en cantidad para cargar rápido
    setTimeout(() => qtyRef.current?.select(), 0);
  };

  const clearSelection = () => {
    setSelected(null);
    setQuery("");
    setQty(1);
    setTimeout(() => searchRef.current?.focus(), 0);
  };

  const maxQty = selected ? availableFor(selected) : 0;
  // Unidades del mismo producto que YA están en este remito: el precio
  // mayorista se calcula por el total acumulado (lo que lleva + lo nuevo).
  const already = selected
    ? remitoItems
        .filter((i) => i.productId === selected.id)
        .reduce((s, i) => s + i.quantity, 0)
    : 0;
  const pricing = selected ? unitPriceFor(selected, qty + already) : null;

  const setQtyClamped = (n: number) => {
    const v = Math.floor(Number.isFinite(n) ? n : 1);
    setQty(Math.min(Math.max(1, v), Math.max(1, maxQty)));
  };

  const handleAddFromCatalog = () => {
    if (!selected || !pricing || qty < 1 || qty > maxQty) return;
    onAdd({
      product: selected.name,
      quantity: qty,
      price: pricing.unit,
      productId: selected.id,
      wholesale: pricing.wholesale,
    });
    clearSelection();
  };

  const handleAddManual = () => {
    const name = query.trim();
    const normalized = (manualPrice || "").replace(/[^0-9,\.]/g, "").replace(/\./g, "").replace(/,/g, ".");
    const p = parseFloat(normalized) || 0;
    if (!name || p <= 0 || qty < 1) return;
    onAdd({ product: name, quantity: qty, price: p });
    setManualMode(false);
    setManualPrice("");
    clearSelection();
  };

  return (
    <div className="bg-rose-whisper rounded-2xl p-3">
      {/* Buscador */}
      <div className="relative">
        <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-ink-soft pointer-events-none" />
        <input
          ref={searchRef}
          type="text"
          placeholder={manualMode ? "Nombre del item manual" : "Buscar producto de la tienda…"}
          value={query}
          onChange={(e) => {
            setQuery(e.target.value);
            if (!manualMode) {
              setOpen(true);
              setHighlight(0);
              if (selected) setSelected(null);
            }
          }}
          onFocus={() => {
            if (!manualMode && query && !selected) setOpen(true);
          }}
          onBlur={() => setTimeout(() => setOpen(false), 150)}
          onKeyDown={(e) => {
            if (manualMode) return;
            if (e.key === "ArrowDown") {
              e.preventDefault();
              setHighlight((h) => Math.min(h + 1, results.length - 1));
            } else if (e.key === "ArrowUp") {
              e.preventDefault();
              setHighlight((h) => Math.max(h - 1, 0));
            } else if (e.key === "Enter" && open && results[highlight]) {
              e.preventDefault();
              selectProduct(results[highlight]);
            } else if (e.key === "Escape") {
              setOpen(false);
            }
          }}
          className="w-full pl-9 pr-24 py-2 bg-white border border-rose-medium/40 rounded-xl text-sm text-ink-primary placeholder:text-ink-soft focus:outline-none focus:border-rose-primary focus:ring-2 focus:ring-rose-pastel"
        />
        <button
          type="button"
          onClick={() => {
            setManualMode((v) => !v);
            setSelected(null);
            setOpen(false);
          }}
          className={`absolute right-1.5 top-1/2 -translate-y-1/2 text-[10px] font-bold uppercase tracking-wide px-2 py-1 rounded-lg transition ${
            manualMode
              ? "bg-rose-deep text-white"
              : "bg-rose-pastel text-ink-secondary hover:bg-rose-medium/50"
          }`}
          title="Cargar un item que no está en la tienda"
        >
          Manual
        </button>

        {/* Dropdown de resultados */}
        {open && !manualMode && query.trim() && (
          <div className="absolute z-20 left-0 right-0 top-full mt-1 bg-white rounded-2xl shadow-lift border border-rose-pastel overflow-hidden">
            {results.length === 0 ? (
              <p className="px-4 py-3 text-xs text-ink-soft">
                Sin resultados en la tienda. Usá el botón <strong>Manual</strong> para cargarlo a mano.
              </p>
            ) : (
              results.map((p, i) => {
                const avail = availableFor(p);
                const out = avail <= 0;
                return (
                  <button
                    key={p.id}
                    type="button"
                    disabled={out}
                    onMouseDown={(e) => {
                      e.preventDefault();
                      selectProduct(p);
                    }}
                    onMouseEnter={() => setHighlight(i)}
                    className={`w-full flex items-center gap-3 px-3 py-2 text-left transition ${
                      out
                        ? "opacity-45 cursor-not-allowed"
                        : i === highlight
                        ? "bg-rose-whisper"
                        : "bg-white hover:bg-rose-whisper"
                    }`}
                  >
                    {p.image ? (
                      // eslint-disable-next-line @next/next/no-img-element
                      <img
                        src={p.image}
                        alt=""
                        className="w-9 h-9 rounded-xl object-cover flex-shrink-0 border border-rose-pastel"
                      />
                    ) : (
                      <div className="w-9 h-9 rounded-xl bg-rose-pastel flex items-center justify-center flex-shrink-0">
                        <ShoppingBag className="w-4 h-4 text-rose-deep" />
                      </div>
                    )}
                    <div className="flex-1 min-w-0">
                      <p className="text-xs font-semibold text-ink-primary truncate">{p.name}</p>
                      <p className="text-[11px] text-ink-soft">
                        {formatPriceARG(p.price)}
                        {p.tiers.length > 0 && (
                          <span className="ml-1.5 inline-flex items-center gap-0.5 text-rose-deep font-bold">
                            <Tag size={9} /> mayorista
                          </span>
                        )}
                      </p>
                    </div>
                    <span
                      className={`text-[10px] font-bold px-2 py-0.5 rounded-full flex-shrink-0 ${
                        out
                          ? "bg-error/15 text-error"
                          : avail <= 5
                          ? "bg-warning/25 text-ink-secondary"
                          : "bg-success/25 text-ink-secondary"
                      }`}
                    >
                      {out ? "Sin stock" : `${avail} disp.`}
                    </span>
                  </button>
                );
              })
            )}
          </div>
        )}
      </div>

      {/* Producto seleccionado del catálogo */}
      {selected && pricing && !manualMode && (
        <div className="mt-2.5 bg-white rounded-2xl border border-rose-pastel p-3">
          <div className="flex items-center gap-2.5 flex-wrap">
            {/* Stepper de cantidad */}
            <div className="flex items-center bg-rose-whisper rounded-xl overflow-hidden">
              <button
                type="button"
                onClick={() => setQtyClamped(qty - 1)}
                className="px-2.5 py-2 text-rose-deep hover:bg-rose-pastel transition disabled:opacity-40"
                disabled={qty <= 1}
              >
                <Minus size={14} />
              </button>
              <input
                ref={qtyRef}
                type="number"
                min={1}
                max={maxQty}
                step={1}
                inputMode="numeric"
                value={qty}
                onFocus={(e) => e.target.select()}
                onChange={(e) => setQtyClamped(parseInt(e.target.value, 10) || 1)}
                onKeyDown={(e) => e.key === "Enter" && handleAddFromCatalog()}
                className="w-12 py-2 text-center text-sm font-bold text-ink-primary bg-transparent focus:outline-none [appearance:textfield] [&::-webkit-outer-spin-button]:appearance-none [&::-webkit-inner-spin-button]:appearance-none"
              />
              <button
                type="button"
                onClick={() => setQtyClamped(qty + 1)}
                className="px-2.5 py-2 text-rose-deep hover:bg-rose-pastel transition disabled:opacity-40"
                disabled={qty >= maxQty}
              >
                <Plus size={14} />
              </button>
            </div>

            <div className="flex-1 min-w-[110px]">
              <p className="text-sm font-bold text-ink-primary leading-tight">
                {formatPriceARG(pricing.unit)}{" "}
                <span className="text-[11px] font-normal text-ink-soft">c/u</span>
              </p>
              <p className="text-[11px] text-ink-soft leading-tight">
                {already > 0 ? (
                  <>
                    Ya lleva {already} u. → total{" "}
                    <strong>{formatPriceARG(pricing.unit * (qty + already))}</strong> · quedan {maxQty}
                  </>
                ) : (
                  <>
                    Total: <strong>{formatPriceARG(pricing.unit * qty)}</strong> · quedan {maxQty}
                  </>
                )}
              </p>
            </div>

            <button
              type="button"
              onClick={handleAddFromCatalog}
              className="btn-primary !py-2 !px-4 !text-sm"
              disabled={qty < 1 || qty > maxQty}
            >
              <Plus size={14} /> Agregar
            </button>

            <button
              type="button"
              onClick={clearSelection}
              className="p-1.5 text-ink-soft hover:text-error transition"
              title="Cancelar"
            >
              <X size={15} />
            </button>
          </div>

          {/* Info mayorista */}
          {pricing.wholesale && (
            <div className="mt-2 flex items-center gap-1.5 bg-rose-deep/10 text-rose-deep rounded-xl px-2.5 py-1.5">
              <Tag size={12} />
              <p className="text-[11px] font-bold">
                Precio mayorista aplicado ({pricing.tier?.label || `${pricing.tier?.units}+ unidades`}
                {pricing.discountPct > 0 ? ` · −${pricing.discountPct}%` : ""})
                {already > 0 ? ` por ${qty + already} u. en total` : ""}
              </p>
            </div>
          )}
          {!pricing.wholesale && selected.tiers.length > 0 && (
            <div className="mt-2 flex items-center gap-1.5 flex-wrap">
              {selected.tiers.map((t, i) => (
                <button
                  key={i}
                  type="button"
                  onClick={() => setQtyClamped(Math.max(1, t.units - already))}
                  disabled={t.units - already > maxQty}
                  className="text-[10px] font-bold bg-rose-pastel hover:bg-rose-medium/50 text-ink-secondary px-2 py-1 rounded-full transition disabled:opacity-40 disabled:cursor-not-allowed"
                  title="Aplicar cantidad mayorista"
                >
                  <Tag size={9} className="inline mr-0.5" />
                  {t.units}+ u → {formatPriceARG(wholesaleTierInfo(t, selected.price).unitPrice)} c/u
                  {already > 0 && t.units - already > 0 ? ` (faltan ${t.units - already})` : ""}
                </button>
              ))}
            </div>
          )}
        </div>
      )}

      {/* Modo manual (item fuera de catálogo) */}
      {manualMode && (
        <div className="mt-2.5 bg-white rounded-2xl border border-rose-pastel p-3 flex items-center gap-2.5 flex-wrap">
          <div className="flex items-center bg-rose-whisper rounded-xl overflow-hidden">
            <button
              type="button"
              onClick={() => setQty((q) => Math.max(1, q - 1))}
              className="px-2.5 py-2 text-rose-deep hover:bg-rose-pastel transition"
            >
              <Minus size={14} />
            </button>
            <input
              type="number"
              min={1}
              step={1}
              inputMode="numeric"
              value={qty}
              onFocus={(e) => e.target.select()}
              onChange={(e) => setQty(Math.max(1, Math.floor(parseInt(e.target.value, 10) || 1)))}
              className="w-12 py-2 text-center text-sm font-bold text-ink-primary bg-transparent focus:outline-none [appearance:textfield] [&::-webkit-outer-spin-button]:appearance-none [&::-webkit-inner-spin-button]:appearance-none"
            />
            <button
              type="button"
              onClick={() => setQty((q) => q + 1)}
              className="px-2.5 py-2 text-rose-deep hover:bg-rose-pastel transition"
            >
              <Plus size={14} />
            </button>
          </div>
          <input
            type="text"
            inputMode="decimal"
            placeholder="$ Precio"
            value={manualPrice}
            onFocus={(e) => e.target.select()}
            onChange={(e) => setManualPrice(e.target.value)}
            onKeyDown={(e) => e.key === "Enter" && handleAddManual()}
            className="flex-1 min-w-[90px] px-3 py-2 bg-rose-whisper border border-rose-medium/40 rounded-xl text-sm text-right text-ink-primary focus:outline-none focus:border-rose-primary"
          />
          <button
            type="button"
            onClick={handleAddManual}
            className="btn-primary !py-2 !px-4 !text-sm"
            disabled={!query.trim() || !manualPrice}
          >
            <Plus size={14} /> Agregar
          </button>
          <button
            type="button"
            onClick={() => {
              setManualMode(false);
              setManualPrice("");
              setQty(1);
              clearSelection();
            }}
            className="p-1.5 text-ink-soft hover:text-error transition"
            title="Cancelar item manual"
          >
            <X size={15} />
          </button>
        </div>
      )}
    </div>
  );
}
