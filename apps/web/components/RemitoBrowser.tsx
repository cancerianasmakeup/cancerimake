"use client";

import { useState } from "react";
import { Plus, Trash2, Eye, Download } from "lucide-react";
import { formatPrice } from "@cancerianas/shared";
import type { Remito } from "@/types/remito";

interface RemitoBrowserProps {
  remitos: Remito[];
  onCreateNew: () => void;
  onEdit: (remito: Remito) => void;
  onDelete: (id: string) => void;
  onViewPDF: (remito: Remito) => void;
}

export default function RemitoBrowser({
  remitos,
  onCreateNew,
  onEdit,
  onDelete,
  onViewPDF,
}: RemitoBrowserProps) {
  const [filter, setFilter] = useState<"all" | "draft" | "sent">("all");

  const filtered = remitos.filter((r) => (filter === "all" ? true : r.status === filter));

  const totalByClient = (remito: Remito) => {
    return remito.items.reduce((sum, item) => sum + item.quantity * item.price, 0);
  };

  return (
    <div className="max-w-6xl">
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4 mb-8">
        <div>
          <h1 className="font-display text-3xl md:text-4xl text-ink-primary">Remitos & Presupuestos</h1>
          <p className="text-ink-secondary mt-1">Genera presupuestos y remitos en vivo para tus clientas</p>
        </div>
        <button
          onClick={onCreateNew}
          className="btn-primary flex items-center justify-center gap-2 w-full sm:w-auto"
        >
          <Plus className="w-4 h-4" />
          Nuevo Remito
        </button>
      </div>

      {/* Filters */}
      <div className="flex gap-2 mb-6">
        {["all", "draft", "sent"].map((status) => (
          <button
            key={status}
            onClick={() => setFilter(status as any)}
            className={`px-4 py-2 rounded-lg font-medium transition-colors ${
              filter === status
                ? "bg-rose-primary text-white"
                : "bg-rose-whisper text-ink-primary hover:bg-rose-pastel"
            }`}
          >
            {status === "all" ? "Todos" : status === "draft" ? "Borradores" : "Enviados"}
          </button>
        ))}
      </div>

      {/* Remitos List */}
      {filtered.length === 0 ? (
        <div className="card text-center py-12">
          <p className="text-ink-secondary mb-4">No hay remitos en esta categoría</p>
          <button onClick={onCreateNew} className="btn-primary">
            <Plus className="w-4 h-4 inline mr-2" />
            Crear el primero
          </button>
        </div>
      ) : (
        <div className="grid gap-4">
          {filtered.map((remito) => (
            <div key={remito.id} className="card hover:shadow-lg transition-shadow">
              <div className="grid grid-cols-1 md:grid-cols-4 gap-4 items-center">
                <div>
                  <p className="text-sm text-ink-secondary">Cliente</p>
                  <p className="font-medium text-ink-primary">{remito.clientName || "Sin nombre"}</p>
                  {remito.clientEmail && (
                    <p className="text-xs text-ink-soft">{remito.clientEmail}</p>
                  )}
                </div>
                <div>
                  <p className="text-sm text-ink-secondary">Items</p>
                  <p className="font-medium text-ink-primary">{remito.items.length} productos</p>
                </div>
                <div>
                  <p className="text-sm text-ink-secondary">Total</p>
                  <p className="font-display text-lg text-rose-primary">
                    {formatPrice(totalByClient(remito))}
                  </p>
                </div>
                <div className="flex gap-2 justify-end">
                  <button
                    onClick={() => onEdit(remito)}
                    className="p-2 hover:bg-rose-whisper rounded-lg transition-colors"
                    title="Editar"
                  >
                    <Eye className="w-4 h-4 text-ink-primary" />
                  </button>
                  <button
                    onClick={() => onViewPDF(remito)}
                    className="p-2 hover:bg-rose-whisper rounded-lg transition-colors"
                    title="Descargar PDF"
                  >
                    <Download className="w-4 h-4 text-ink-primary" />
                  </button>
                  <button
                    onClick={() => {
                      if (
                        window.confirm(`¿Eliminar remito para ${remito.clientName}?`)
                      ) {
                        onDelete(remito.id);
                      }
                    }}
                    className="p-2 hover:bg-error/10 rounded-lg transition-colors"
                    title="Eliminar"
                  >
                    <Trash2 className="w-4 h-4 text-error" />
                  </button>
                </div>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
