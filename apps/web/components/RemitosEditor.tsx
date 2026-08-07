"use client";

import { useState, useMemo, useRef } from "react";
import { ArrowLeft, Trash2, Download, Loader, Loader2, Tag } from "lucide-react";
import { formatPrice } from "@cancerianas/shared";
import { generateRemitoPDF } from "@/lib/remito-pdf";
import ProductPicker from "@/components/ProductPicker";
import { unitPriceFor, useCatalog } from "@/lib/remito-catalog";
import type { Remito, RemitItem } from "@/types/remito";

interface RemitosEditorProps {
  remito: Remito;
  onUpdate: (remito: Remito) => void;
  onBack: () => void;
}

export default function RemitosEditor({ remito, onUpdate, onBack }: RemitosEditorProps) {
  const [clientName, setClientName] = useState(remito.clientName);
  const [clientEmail, setClientEmail] = useState(remito.clientEmail);
  const [clientPhone, setClientPhone] = useState(remito.clientPhone);
  const [notes, setNotes] = useState(remito.notes);
  const [items, setItems] = useState<RemitItem[]>(remito.items);
  const [deposit, setDeposit] = useState(remito.deposit || 0);
  const [isGeneratingPDF, setIsGeneratingPDF] = useState(false);
  const formRef = useRef<HTMLFormElement>(null);
  const { catalog, catalogState } = useCatalog();

  // Unidades ya cargadas de cada producto en este presupuesto: el picker las
  // descuenta del stock disponible para no vender más de lo que hay.
  const reserved = useMemo(() => {
    const m = new Map<string, number>();
    for (const it of items) {
      if (it.productId) m.set(it.productId, (m.get(it.productId) ?? 0) + it.quantity);
    }
    return m;
  }, [items]);

  const formatInputPrice = (value: string) => {
    const normalized = value.replace(/[^0-9,\.]/g, "").replace(/\./g, "").replace(/,/g, ".");
    const numberValue = parseFloat(normalized);
    return Number.isNaN(numberValue) ? 0 : numberValue;
  };

  // Alta desde el picker (escaneo, búsqueda o item manual). Si el producto ya
  // está en el presupuesto lo fusionamos en una sola línea y recalculamos el
  // precio unitario según la CANTIDAD TOTAL, para que el mayorista se aplique
  // aunque las unidades se hayan escaneado de a una.
  const addItem = (item: Omit<RemitItem, "id">) => {
    setItems((prev) => {
      if (item.productId) {
        const existing = prev.find((i) => i.productId === item.productId);
        if (existing) {
          const totalQty = existing.quantity + item.quantity;
          const prod = catalog.find((p) => p.id === item.productId);
          const pricing = prod ? unitPriceFor(prod, totalQty) : null;
          return prev.map((i) =>
            i.id === existing.id
              ? {
                  ...i,
                  quantity: totalQty,
                  price: pricing ? pricing.unit : i.price,
                  wholesale: pricing ? pricing.wholesale : i.wholesale,
                }
              : i
          );
        }
      }
      return [...prev, { id: Math.random().toString(36).slice(2, 11), ...item }];
    });
  };

  const removeItem = (id: string) => {
    setItems(items.filter((item) => item.id !== id));
  };

  const updateItem = (id: string, field: keyof RemitItem, value: any) => {
    setItems(
      items.map((item) => {
        if (item.id !== id) return item;
        const next = { ...item, [field]: value };
        // Si es un producto del catálogo y cambió la cantidad, el precio
        // unitario se recalcula solo (entra o sale del pack mayorista).
        if (field === "quantity" && next.productId) {
          const prod = catalog.find((p) => p.id === next.productId);
          if (prod) {
            const pricing = unitPriceFor(prod, next.quantity);
            next.price = pricing.unit;
            next.wholesale = pricing.wholesale;
          }
        }
        return next;
      })
    );
  };

  const calculateTotal = () => {
    return items.reduce((sum, item) => sum + item.quantity * item.price, 0);
  };

  const handleSave = () => {
    const updated = {
      ...remito,
      clientName,
      clientEmail,
      clientPhone,
      notes,
      items,
      deposit,
    };
    onUpdate(updated);
    alert("Remito guardado");
  };

  const handleDownloadPDF = async () => {
    if (!clientName || items.length === 0) {
      alert("Completa el nombre de la clienta y agrega al menos un item");
      return;
    }

    try {
      setIsGeneratingPDF(true);
      const updated = {
        ...remito,
        clientName,
        clientEmail,
        clientPhone,
        notes,
        items,
        deposit,
      };
      await generateRemitoPDF(updated);
      alert("PDF descargado exitosamente");
    } catch (error) {
      console.error("Error generating PDF:", error);
      alert("Error al generar el PDF. Intenta nuevamente.");
    } finally {
      setIsGeneratingPDF(false);
    }
  };

  const subtotal = calculateTotal();
  const iva = 0; // IVA ya está incluido en los precios
  const total = subtotal - deposit;
  const grandTotal = Math.max(total, 0);

  return (
    <div className="max-w-5xl">
      {/* Header */}
      <div className="flex items-center gap-4 mb-8">
        <button
          onClick={onBack}
          className="p-2 hover:bg-rose-whisper rounded-lg transition-colors"
        >
          <ArrowLeft className="w-5 h-5" />
        </button>
        <div>
          <h1 className="font-display text-3xl text-ink-primary">
            {clientName || "Nuevo Remito"}
          </h1>
          <p className="text-ink-secondary text-sm">
            {new Date(remito.createdAt).toLocaleDateString("es-AR")}
          </p>
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Main Editor */}
        <div className="lg:col-span-2 space-y-6">
          {/* Client Info */}
          <div className="card">
            <h2 className="font-display text-xl mb-4 text-ink-primary">
              Información de la Clienta
            </h2>
            <div className="space-y-4">
              <div>
                <label className="block text-sm font-medium text-ink-primary mb-1">
                  Nombre *
                </label>
                <input
                  type="text"
                  value={clientName}
                  onChange={(e) => setClientName(e.target.value)}
                  className="input w-full"
                  placeholder="Nombre de la clienta"
                />
              </div>
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="block text-sm font-medium text-ink-primary mb-1">
                    Email
                  </label>
                  <input
                    type="email"
                    value={clientEmail}
                    onChange={(e) => setClientEmail(e.target.value)}
                    className="input w-full"
                    placeholder="correo@example.com"
                  />
                </div>
                <div>
                  <label className="block text-sm font-medium text-ink-primary mb-1">
                    Teléfono
                  </label>
                  <input
                    type="tel"
                    value={clientPhone}
                    onChange={(e) => setClientPhone(e.target.value)}
                    className="input w-full"
                    placeholder="+54 9 11 XXXX-XXXX"
                  />
                </div>
              </div>
            </div>
          </div>

          {/* Items Section */}
          <div className="card">
            <div className="flex items-center justify-between gap-3 flex-wrap mb-4">
              <h2 className="font-display text-xl text-ink-primary">Items</h2>
              {catalogState === "loading" && (
                <span className="inline-flex items-center gap-1.5 text-xs text-ink-soft">
                  <Loader2 className="w-3.5 h-3.5 animate-spin" /> Cargando catálogo…
                </span>
              )}
              {catalogState === "ready" && (
                <span className="text-xs text-ink-soft">
                  {catalog.length} productos listos para escanear
                </span>
              )}
              {catalogState === "error" && (
                <span className="text-xs text-error font-semibold">
                  No se pudo cargar el catálogo — cargá los items con el botón Manual
                </span>
              )}
            </div>

            {/* Escaneo / búsqueda / item manual */}
            <div className="mb-6">
              <ProductPicker
                catalog={catalog}
                reserved={reserved}
                remitoItems={items}
                onAdd={addItem}
              />
            </div>

            {/* Items Table */}
            {items.length === 0 ? (
              <p className="text-center text-ink-secondary py-8">
                Sin items aún. Agrega el primero arriba.
              </p>
            ) : (
              <div className="overflow-x-auto">
                <table className="w-full text-sm">
                  <thead>
                    <tr className="border-b border-rose-pastel">
                      <th className="text-left py-3 px-4 font-medium text-ink-primary">
                        Producto
                      </th>
                      <th className="text-center py-3 px-4 font-medium text-ink-primary w-20">
                        Cantidad
                      </th>
                      <th className="text-right py-3 px-4 font-medium text-ink-primary w-24">
                        Precio
                      </th>
                      <th className="text-right py-3 px-4 font-medium text-ink-primary w-24">
                        Total
                      </th>
                      <th className="text-center py-3 px-4 w-12"></th>
                    </tr>
                  </thead>
                  <tbody>
                    {items.map((item) => (
                      <tr
                        key={item.id}
                        className="border-b border-rose-pastel hover:bg-rose-whisper"
                      >
                        <td className="py-3 px-4">
                          <input
                            type="text"
                            value={item.product}
                            onChange={(e) =>
                              updateItem(item.id, "product", e.target.value)
                            }
                            className="input w-full"
                          />
                          {item.wholesale && (
                            <span className="mt-1 inline-flex items-center gap-0.5 bg-rose-deep text-white text-[9px] font-bold uppercase tracking-wide px-1.5 py-0.5 rounded-full">
                              <Tag size={8} /> Mayorista
                            </span>
                          )}
                        </td>
                        <td className="py-3 px-4">
                          <input
                            type="number"
                            value={item.quantity}
                            onFocus={(e) => e.target.select()}
                            onChange={(e) =>
                              updateItem(
                                item.id,
                                "quantity",
                                Math.max(0, Math.floor(parseInt(e.target.value, 10) || 0))
                              )
                            }
                            className="input text-center"
                            min="1"
                            step="1"
                            inputMode="numeric"
                          />
                        </td>
                        <td className="py-3 px-4">
                          <input
                            type="text"
                            value={formatPrice(item.price)}
                            onChange={(e) => {
                              const raw = e.target.value.replace(/[^0-9,\.]/g, "");
                              updateItem(item.id, "price", formatInputPrice(raw));
                            }}
                            className="input text-right"
                            placeholder="$ 0,00"
                          />
                        </td>
                        <td className="py-3 px-4 text-right font-medium">
                          {formatPrice(item.quantity * item.price)}
                        </td>
                        <td className="py-3 px-4 text-center">
                          <button
                            onClick={() => removeItem(item.id)}
                            className="p-1 hover:bg-error/10 rounded transition-colors"
                          >
                            <Trash2 className="w-4 h-4 text-error" />
                          </button>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </div>

          {/* Notes */}
          <div className="card">
            <label className="block text-sm font-medium text-ink-primary mb-2">
              Notas
            </label>
            <textarea
              value={notes}
              onChange={(e) => setNotes(e.target.value)}
              className="input w-full h-24"
              placeholder="Notas adicionales, términos y condiciones, etc."
            />
          </div>
        </div>

        {/* Sidebar - Summary */}
        <div className="space-y-4">
          {/* Summary Card */}
          <div className="card bg-gradient-to-br from-rose-whisper to-cream sticky top-4">
            <h3 className="font-display text-lg text-ink-primary mb-4">Resumen</h3>

            <div className="space-y-3 mb-6 pb-4 border-b border-rose-pastel">
              <div className="flex justify-between text-sm">
                <span className="text-ink-secondary">Subtotal</span>
                <span className="font-medium text-ink-primary">
                  {formatPrice(subtotal)}
                </span>
              </div>
              <div className="flex justify-between text-sm">
                <span className="text-ink-secondary">IVA (21%)</span>
                <span className="font-medium text-ink-primary">
                  {formatPrice(iva)}
                </span>
              </div>
            </div>

            {/* Deposit Section */}
            <div className="mb-6 p-3 bg-amber-50 rounded-lg border border-amber-200">
              <label className="block text-sm font-medium text-ink-primary mb-2">
                Seña (adelanto)
              </label>
              <input
                type="text"
                value={deposit > 0 ? formatPrice(deposit) : ""}
                onChange={(e) => {
                  const raw = e.target.value.replace(/[^0-9,\.]/g, "");
                  const num = parseFloat(raw.replace(/\./g, "").replace(/,/g, ".")) || 0;
                  setDeposit(num);
                }}
                onBlur={() => {
                  if (deposit > 0) {
                    // Ensure formatted display
                  }
                }}
                className="input w-full text-center"
                placeholder="$ 0,00"
              />
            </div>

            <div className="flex justify-between mb-6">
              <span className="font-display text-lg text-ink-primary">Total a pagar</span>
              <span className="font-display text-2xl text-rose-primary">
                {formatPrice(grandTotal)}
              </span>
            </div>

            {/* Item Count */}
            <div className="text-sm text-ink-secondary mb-6 p-3 bg-white/50 rounded">
              {items.length} item{items.length !== 1 ? "s" : ""} en el presupuesto
            </div>

            {/* Actions */}
            <div className="space-y-2">
              <button
                onClick={handleSave}
                className="btn-primary w-full"
              >
                💾 Guardar
              </button>
              <button
                onClick={handleDownloadPDF}
                disabled={!clientName || items.length === 0 || isGeneratingPDF}
                className="btn-primary bg-green-500 hover:bg-green-600 disabled:opacity-50 disabled:cursor-not-allowed w-full flex items-center justify-center gap-2"
              >
                {isGeneratingPDF ? (
                  <>
                    <Loader className="w-4 h-4 animate-spin" />
                    Generando...
                  </>
                ) : (
                  <>
                    <Download className="w-4 h-4" />
                    Descargar PDF
                  </>
                )}
              </button>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
