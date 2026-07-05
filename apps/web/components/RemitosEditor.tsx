"use client";

import { useState, useRef } from "react";
import { ArrowLeft, Plus, Trash2, Download, Send, Loader } from "lucide-react";
import { formatPrice } from "@cancerianas/shared";
import { generateRemitoPDF } from "@/lib/remito-pdf";
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
  const [newItemProduct, setNewItemProduct] = useState("");
  const [newItemQuantity, setNewItemQuantity] = useState("1");
  const [newItemPrice, setNewItemPrice] = useState("");
  const [deposit, setDeposit] = useState(remito.deposit || 0);
  const [isGeneratingPDF, setIsGeneratingPDF] = useState(false);
  const formRef = useRef<HTMLFormElement>(null);

  const formatInputPrice = (value: string) => {
    const normalized = value.replace(/[^0-9,\.]/g, "").replace(/\./g, "").replace(/,/g, ".");
    const numberValue = parseFloat(normalized);
    return Number.isNaN(numberValue) ? 0 : numberValue;
  };

  const addItem = () => {
    if (!newItemProduct || !newItemPrice) {
      alert("Por favor completa producto y precio");
      return;
    }

    const newItem: RemitItem = {
      id: Math.random().toString(36).substr(2, 9),
      product: newItemProduct,
      quantity: Math.max(1, Math.floor(parseInt(newItemQuantity, 10) || 1)),
      price: formatInputPrice(newItemPrice),
    };

    setItems([...items, newItem]);
    setNewItemProduct("");
    setNewItemQuantity("1");
    setNewItemPrice("");
  };

  const removeItem = (id: string) => {
    setItems(items.filter((item) => item.id !== id));
  };

  const updateItem = (id: string, field: keyof RemitItem, value: any) => {
    setItems(
      items.map((item) =>
        item.id === id ? { ...item, [field]: value } : item
      )
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
            <h2 className="font-display text-xl mb-4 text-ink-primary">Items</h2>

            {/* Add Item Form */}
            <div className="bg-rose-whisper p-4 rounded-lg mb-6">
              <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-4 gap-3 mb-3">
                <input
                  type="text"
                  value={newItemProduct}
                  onChange={(e) => setNewItemProduct(e.target.value)}
                  className="input"
                  placeholder="Producto"
                />
                <input
                  type="number"
                  value={newItemQuantity}
                  onFocus={(e) => e.target.select()}
                  onChange={(e) => setNewItemQuantity(e.target.value.replace(/[.,].*$/, ""))}
                  className="input"
                  placeholder="Cantidad"
                  min="1"
                  step="1"
                  inputMode="numeric"
                />
                <input
                  type="text"
                  value={newItemPrice}
                  onChange={(e) => {
                    const raw = e.target.value;
                    const formatted = raw.replace(/[^0-9,\.]/g, "");
                    setNewItemPrice(formatted);
                  }}
                  onBlur={() => {
                    const numeric = formatInputPrice(newItemPrice);
                    setNewItemPrice(numeric ? formatPrice(numeric) : "");
                  }}
                  onFocus={() => {
                    if (newItemPrice) {
                      setNewItemPrice(String(formatInputPrice(newItemPrice)));
                    }
                  }}
                  className="input"
                  placeholder="$ 0,00"
                />
                <button
                  onClick={addItem}
                  className="btn-primary flex items-center justify-center gap-2"
                >
                  <Plus className="w-4 h-4" />
                  Agregar
                </button>
              </div>
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
