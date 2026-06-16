"use client";

import { useState, useEffect } from "react";
import { Remito, RemitItem } from "@/types/remito";
import { Trash2, Plus, Download, Eye, Edit2, Check, X } from "lucide-react";

// Función para formatear precio con separador de miles y moneda argentina
function formatPriceARG(price: number): string {
  return new Intl.NumberFormat("es-AR", {
    style: "currency",
    currency: "ARS",
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  }).format(price);
}

interface LiveRemito extends Remito {
  tempId: string;
}

const PREDEFINED_CLIENTS = [
  { id: 1, name: "Cliente TikTok Live 1", email: "cliente1@tiktok.com", phone: "+54 9 1234-5678" },
  { id: 2, name: "Cliente TikTok Live 2", email: "cliente2@tiktok.com", phone: "+54 9 2345-6789" },
  { id: 3, name: "Cliente TikTok Live 3", email: "cliente3@tiktok.com", phone: "+54 9 3456-7890" },
  { id: 4, name: "Cliente TikTok Live 4", email: "cliente4@tiktok.com", phone: "+54 9 4567-8901" },
  { id: 5, name: "Cliente TikTok Live 5", email: "cliente5@tiktok.com", phone: "+54 9 5678-9012" },
  { id: 6, name: "Cliente TikTok Live 6", email: "cliente6@tiktok.com", phone: "+54 9 6789-0123" },
  { id: 7, name: "Cliente TikTok Live 7", email: "cliente7@tiktok.com", phone: "+54 9 7890-1234" },
  { id: 8, name: "Cliente TikTok Live 8", email: "cliente8@tiktok.com", phone: "+54 9 8901-2345" },
];

export default function MultipleRemitosLive() {
  const [remitos, setRemitos] = useState<LiveRemito[]>([]);
  const [isLoaded, setIsLoaded] = useState(false);

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

  const addNewRemito = (clientIndex: number) => {
    const client = PREDEFINED_CLIENTS[clientIndex];
    const newRemito: LiveRemito = {
      id: `remito-${Date.now()}-${Math.random()}`,
      tempId: `live-${Date.now()}`,
      createdAt: new Date().toISOString(),
      clientName: client.name,
      clientEmail: client.email,
      clientPhone: client.phone,
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
        r.tempId === tempId
          ? {
              ...r,
              clientEmail: newEmail,
              clientPhone: newPhone,
            }
          : r
      )
    );
  };

  const updateClientName = (tempId: string, newName: string) => {
    setRemitos(
      remitos.map((r) =>
        r.tempId === tempId
          ? {
              ...r,
              clientName: newName,
            }
          : r
      )
    );
  };

  const deleteRemito = (tempId: string) => {
    setRemitos(remitos.filter((r) => r.tempId !== tempId));
  };

  const addItemToRemito = (tempId: string, product: string, quantity: number, price: number) => {
    setRemitos(
      remitos.map((r) =>
        r.tempId === tempId
          ? {
              ...r,
              items: [
                ...r.items,
                {
                  id: `item-${Date.now()}`,
                  product,
                  quantity,
                  price,
                },
              ],
            }
          : r
      )
    );
  };

  const removeItemFromRemito = (tempId: string, itemId: string) => {
    setRemitos(
      remitos.map((r) =>
        r.tempId === tempId
          ? {
              ...r,
              items: r.items.filter((i) => i.id !== itemId),
            }
          : r
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

  return (
    <div className="min-h-screen bg-gradient-to-br from-rose-soft via-white to-rose-light p-6">
      <div className="max-w-7xl mx-auto">
        {/* Header */}
        <div className="bg-white rounded-xl shadow-lg p-8 mb-8 border-t-4 border-rose-deep">
          <h1 className="text-4xl font-bold text-ink-primary mb-2">
            🔴 REMITOS EN VIVO
          </h1>
          <p className="text-ink-secondary text-lg">
            Para TikTok Live - Agrega múltiples remitos simultáneamente
          </p>
        </div>

        {/* Botones de clientes predefinidos */}
        <div className="bg-white rounded-xl shadow-lg p-6 mb-8">
          <h2 className="text-lg font-bold text-ink-primary mb-4">Agregar Cliente:</h2>
          <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
            {PREDEFINED_CLIENTS.map((client, idx) => (
              <button
                key={idx}
                onClick={() => addNewRemito(idx)}
                className="bg-gradient-to-r from-rose-primary to-rose-deep text-white py-2 px-3 rounded-lg hover:shadow-lg transition font-semibold text-sm"
              >
                Agregar cliente +
              </button>
            ))}
          </div>
        </div>

        {/* Grid de remitos */}
        {remitos.length > 0 && (
          <div className="mb-8">
            <div className="flex justify-between items-center mb-6">
              <h2 className="text-2xl font-bold text-ink-primary">
                {remitos.length} Remito{remitos.length !== 1 ? "s" : ""} en construcción
              </h2>
              {remitos.some((r) => r.items.length > 0) && (
                <button
                  onClick={downloadAllRemitos}
                  className="bg-green-500 hover:bg-green-600 text-white py-2 px-6 rounded-lg flex items-center gap-2 font-semibold transition"
                >
                  <Download size={20} /> Descargar Todos ({remitos.filter((r) => r.items.length > 0).length})
                </button>
              )}
            </div>

            <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
              {remitos.map((remito) => (
                <RemitCard
                  key={remito.tempId}
                  remito={remito}
                  onAddItem={addItemToRemito}
                  onRemoveItem={removeItemFromRemito}
                  onDelete={deleteRemito}
                  onUpdateClientName={updateClientName}
                  onUpdateClientContact={updateClientContact}
                />
              ))}
            </div>
          </div>
        )}

        {remitos.length === 0 && isLoaded && (
          <div className="text-center py-16 bg-white rounded-xl shadow-lg">
            <p className="text-ink-secondary text-lg mb-4">
              👉 Comienza agregando un cliente desde arriba
            </p>
            <p className="text-gray-400">Los remitos se guardan automáticamente</p>
          </div>
        )}
      </div>
    </div>
  );
}

interface RemitCardProps {
  remito: LiveRemito;
  onAddItem: (tempId: string, product: string, quantity: number, price: number) => void;
  onRemoveItem: (tempId: string, itemId: string) => void;
  onDelete: (tempId: string) => void;
  onUpdateClientName: (tempId: string, newName: string) => void;
  onUpdateClientContact: (tempId: string, newEmail: string, newPhone: string) => void;
}

function RemitCard({ remito, onAddItem, onRemoveItem, onDelete, onUpdateClientName, onUpdateClientContact }: RemitCardProps) {
  const [product, setProduct] = useState("");
  const [quantity, setQuantity] = useState(1);
  const [price, setPrice] = useState(0);
  const [quantityInput, setQuantityInput] = useState<string>(String(1));
  const [priceInput, setPriceInput] = useState<string>(formatPriceARG(0));
  const [isEditingName, setIsEditingName] = useState(false);
  const [editedName, setEditedName] = useState(remito.clientName);
  const [isEditingEmail, setIsEditingEmail] = useState(false);
  const [isEditingPhone, setIsEditingPhone] = useState(false);
  const [editedEmail, setEditedEmail] = useState(remito.clientEmail || "");
  const [editedPhone, setEditedPhone] = useState(remito.clientPhone || "");
  const [depositInput, setDepositInput] = useState<string>(remito.deposit > 0 ? formatPriceARG(remito.deposit) : "");

  const handleAddItem = () => {
    const q = Math.max(1, parseInt(quantityInput || "0") || 0);
    // normalize price input: remove thousand separators and use dot as decimal
    const normalized = (priceInput || "").replace(/\./g, "").replace(/,/g, ".");
    const p = parseFloat(normalized) || 0;
    if (product.trim() && q > 0 && p > 0) {
      onAddItem(remito.tempId, product, q, p);
      setProduct("");
      setQuantity(1);
      setQuantityInput(String(1));
      setPrice(0);
      setPriceInput(formatPriceARG(0));
    }
  };

  const subtotal = remito.items.reduce((sum, item) => sum + item.quantity * item.price, 0);
  const depositNum = depositInput ? parseFloat(depositInput.replace(/\./g, "").replace(/,/g, ".")) : 0;
  const total = Math.max(subtotal - depositNum, 0);

  return (
    <div className="bg-white rounded-lg shadow-md overflow-hidden border-l-4 border-rose-primary hover:shadow-lg transition">
      {/* Header card */}
      <div className="bg-gradient-to-r from-rose-primary to-rose-deep text-white p-4">
        <div className="flex justify-between items-start mb-2">
          {isEditingName ? (
            <div className="flex gap-2 items-center flex-1">
              <input
                type="text"
                value={editedName}
                onChange={(e) => setEditedName(e.target.value)}
                className="flex-1 px-2 py-1 rounded text-ink-primary font-bold text-sm"
                autoFocus
              />
              <button
                onClick={() => {
                  if (editedName.trim()) {
                    onUpdateClientName(remito.tempId, editedName);
                    setIsEditingName(false);
                  }
                }}
                className="bg-white hover:bg-green-100 p-1 rounded text-green-600 transition"
              >
                <Check size={16} />
              </button>
              <button
                onClick={() => {
                  setEditedName(remito.clientName);
                  setIsEditingName(false);
                }}
                className="bg-white hover:bg-red-100 p-1 rounded text-red-600 transition"
              >
                <X size={16} />
              </button>
            </div>
          ) : (
            <>
              <div className="flex-1 cursor-pointer hover:opacity-80" onClick={() => setIsEditingName(true)}>
                <h3 className="font-bold text-lg flex items-center gap-2">
                  {remito.clientName}
                  <Edit2 size={14} className="opacity-60" />
                </h3>
              </div>
              <div className="flex items-center gap-3">
                <div className="text-sm">
                  {isEditingEmail ? (
                    <div className="flex items-center gap-2">
                      <input
                        className="px-2 py-1 rounded text-sm text-ink-primary"
                        value={editedEmail}
                        onChange={(e) => setEditedEmail(e.target.value)}
                      />
                      <button
                        onClick={() => {
                          onUpdateClientContact(remito.tempId, editedEmail, remito.clientPhone || "");
                          setIsEditingEmail(false);
                        }}
                        className="bg-white p-1 rounded text-green-600"
                      >
                        <Check size={14} />
                      </button>
                      <button onClick={() => { setEditedEmail(remito.clientEmail || ""); setIsEditingEmail(false); }} className="bg-white p-1 rounded text-red-600"><X size={14} /></button>
                    </div>
                  ) : (
                    <div className="flex items-center gap-2">
                      <p className="text-sm opacity-90">{remito.clientEmail}</p>
                      <button onClick={() => setIsEditingEmail(true)} className="text-white bg-transparent p-1"><Edit2 size={14} /></button>
                    </div>
                  )}
                </div>
                <div className="text-sm">
                  {isEditingPhone ? (
                    <div className="flex items-center gap-2">
                      <input
                        className="px-2 py-1 rounded text-sm text-ink-primary"
                        value={editedPhone}
                        onChange={(e) => setEditedPhone(e.target.value)}
                      />
                      <button
                        onClick={() => {
                          onUpdateClientContact(remito.tempId, remito.clientEmail || "", editedPhone);
                          setIsEditingPhone(false);
                        }}
                        className="bg-white p-1 rounded text-green-600"
                      >
                        <Check size={14} />
                      </button>
                      <button onClick={() => { setEditedPhone(remito.clientPhone || ""); setIsEditingPhone(false); }} className="bg-white p-1 rounded text-red-600"><X size={14} /></button>
                    </div>
                  ) : (
                    <div className="flex items-center gap-2">
                      <p className="text-sm opacity-90">{remito.clientPhone}</p>
                      <button onClick={() => setIsEditingPhone(true)} className="text-white bg-transparent p-1"><Edit2 size={14} /></button>
                    </div>
                  )}
                </div>
              </div>
              <button
                onClick={() => onDelete(remito.tempId)}
                className="bg-red-500 hover:bg-red-600 p-1 rounded text-white transition"
              >
                <Trash2 size={16} />
              </button>
            </>
          )}
        </div>
        
      </div>

      {/* Contenido */}
      <div className="p-4">
        {/* Agregar item */}
        <div className="mb-4 p-3 bg-rose-soft rounded-lg">
          <p className="text-xs font-bold text-ink-secondary mb-2">Agregar Producto:</p>
          <input
            type="text"
            placeholder="Nombre del producto"
            value={product}
            onChange={(e) => setProduct(e.target.value)}
            onKeyPress={(e) => e.key === "Enter" && handleAddItem()}
            className="w-full px-2 py-1 border border-rose-primary rounded text-sm mb-2"
          />
          <div className="flex gap-2 items-center">
            <div className="flex flex-col">
              <label className="text-xs text-ink-secondary">Cantidad</label>
              <input
                type="number"
                placeholder="Cantidad"
                value={quantityInput}
                onFocus={() => setQuantityInput("")}
                onBlur={() => {
                  const q = Math.max(1, parseInt(quantityInput || "") || 1);
                  setQuantity(q);
                  setQuantityInput(String(q));
                }}
                onChange={(e) => setQuantityInput(e.target.value)}
                className="w-24 px-2 py-1 border border-rose-primary rounded text-sm"
              />
            </div>
            <div className="flex-1 flex flex-col">
              <label className="text-xs text-ink-secondary">Precio</label>
              <input
                type="text"
                placeholder="$ 0,00"
                value={priceInput}
                onFocus={() => setPriceInput(price > 0 ? String(price) : "")}
                onChange={(e) => {
                  const v = e.target.value;
                  // allow digits, dots and commas
                  setPriceInput(v);
                  const normalized = v.replace(/\./g, "").replace(/,/g, ".");
                  const n = parseFloat(normalized) || 0;
                  setPrice(n);
                }}
                onBlur={() => setPriceInput(formatPriceARG(price))}
                className="flex-1 px-2 py-1 border border-rose-primary rounded text-sm"
              />
            </div>
            <button
              onClick={handleAddItem}
              className="bg-rose-primary hover:bg-rose-deep text-white px-3 py-1 rounded text-sm font-semibold transition flex items-center gap-1"
            >
              <Plus size={14} /> Agregar
            </button>
          </div>
        </div>

        {/* Items */}
        <div className="mb-4 max-h-48 overflow-y-auto">
          {remito.items.length === 0 ? (
            <p className="text-center text-ink-secondary text-sm py-4">Sin productos</p>
          ) : (
            <div className="space-y-2">
              {remito.items.map((item) => (
                <div key={item.id} className="flex justify-between items-center text-sm p-2 bg-rose-light rounded">
                  <div className="flex-1">
                    <p className="font-semibold text-ink-primary text-xs">{item.product}</p>
                    <p className="text-ink-secondary text-xs">
                      {item.quantity} × {formatPriceARG(item.price)} = {formatPriceARG(item.quantity * item.price)}
                    </p>
                  </div>
                  <button
                    onClick={() => onRemoveItem(remito.tempId, item.id)}
                    className="text-red-500 hover:text-red-700 ml-2"
                  >
                    <Trash2 size={14} />
                  </button>
                </div>
              ))}
            </div>
          )}
        </div>

        {/* Seña / Adelanto */}
        <div className="mb-3 p-2 bg-amber-50 rounded border border-amber-200">
          <label className="text-xs font-semibold text-amber-800 block mb-1">Seña (adelanto):</label>
          <input
            type="text"
            value={depositInput}
            onChange={(e) => {
              const v = e.target.value;
              setDepositInput(v);
            }}
            onBlur={() => {
              const num = depositInput ? parseFloat(depositInput.replace(/\./g, "").replace(/,/g, ".")) : 0;
              const updated = { ...remito, deposit: num };
              // Update in parent if needed (for now just local state)
            }}
            className="w-full px-2 py-1 text-xs border border-amber-300 rounded text-right"
            placeholder="$ 0,00"
          />
        </div>

        {/* Totales */}
        <div className="bg-gradient-to-r from-rose-primary to-rose-deep text-white p-3 rounded-lg text-sm">
          <div className="flex justify-between mb-2">
            <span>Subtotal:</span>
            <span className="font-semibold">{formatPriceARG(subtotal)}</span>
          </div>
          {depositNum > 0 && (
            <div className="flex justify-between mb-2 text-amber-100">
              <span>Menos seña:</span>
              <span className="font-semibold">-{formatPriceARG(depositNum)}</span>
            </div>
          )}
          <div className="border-t border-white opacity-50 my-2"></div>
          <div className="flex justify-between text-lg">
            <span className="font-bold">TOTAL:</span>
            <span className="font-bold">{formatPriceARG(total)}</span>
          </div>
        </div>

        {/* Botón descargar individual */}
        {remito.items.length > 0 && (
          <button
            onClick={async () => {
              const { generateRemitoPDF } = await import("@/lib/remito-pdf");
              generateRemitoPDF(remito);
            }}
            className="w-full mt-3 bg-blue-500 hover:bg-blue-600 text-white py-2 rounded-lg font-semibold transition flex items-center justify-center gap-2"
          >
            <Download size={16} /> Descargar PDF
          </button>
        )}
      </div>
    </div>
  );
}
