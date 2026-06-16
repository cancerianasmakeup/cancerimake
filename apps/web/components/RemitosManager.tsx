"use client";

import { useState, useEffect, useRef } from "react";
import { Plus, Trash2, Download, Eye, ArrowLeft } from "lucide-react";
import RemitoBrowser from "./RemitoBrowser";
import RemitosEditor from "./RemitosEditor";
import MultipleRemitosLive from "./MultipleRemitosLive";
import type { Remito, RemitItem } from "@/types/remito";

const STORAGE_KEY = "cancerianas_remitos";

export default function RemitosManager() {
  const [remitos, setRemitos] = useState<Remito[]>([]);
  const [activeRemito, setActiveRemito] = useState<Remito | null>(null);
  const [viewMode, setViewMode] = useState<"browser" | "editor">("browser");
  const [remitosMode, setRemitosMode] = useState<"single" | "multiple">("single");
  const [isLoaded, setIsLoaded] = useState(false);

  // Cargar remitos del localStorage al montar
  useEffect(() => {
    try {
      const saved = localStorage.getItem(STORAGE_KEY);
      if (saved) {
        setRemitos(JSON.parse(saved));
      }
    } catch (error) {
      console.error("Error loading remitos:", error);
    }
    setIsLoaded(true);
  }, []);

  // Guardar remitos en localStorage cuando cambian
  useEffect(() => {
    if (isLoaded) {
      try {
        localStorage.setItem(STORAGE_KEY, JSON.stringify(remitos));
      } catch (error) {
        console.error("Error saving remitos:", error);
      }
    }
  }, [remitos, isLoaded]);

  const createNewRemito = () => {
    const newRemito: Remito = {
      id: Math.random().toString(36).substr(2, 9),
      createdAt: new Date().toISOString(),
      clientName: "",
      clientEmail: "",
      clientPhone: "",
      items: [],
      notes: "",
      deposit: 0,
      status: "draft",
    };
    setRemitos([...remitos, newRemito]);
    setActiveRemito(newRemito);
    setViewMode("editor");
  };

  const updateRemito = (remito: Remito) => {
    setRemitos(remitos.map((r) => (r.id === remito.id ? remito : r)));
    setActiveRemito(remito);
  };

  const deleteRemito = (id: string) => {
    setRemitos(remitos.filter((r) => r.id !== id));
    if (activeRemito?.id === id) {
      setActiveRemito(null);
      setViewMode("browser");
    }
  };

  if (!isLoaded) {
    return <div className="text-center py-12">Cargando...</div>;
  }

  // Modo múltiples remitos
  if (remitosMode === "multiple") {
    return (
      <div>
        <button
          onClick={() => setRemitosMode("single")}
          className="mb-4 bg-ink-secondary hover:bg-ink-primary text-white py-2 px-4 rounded-lg flex items-center gap-2 font-semibold transition"
        >
          <ArrowLeft size={18} /> Volver a Remitos Individuales
        </button>
        <MultipleRemitosLive />
      </div>
    );
  }

  if (viewMode === "editor" && activeRemito) {
    return (
      <RemitosEditor
        remito={activeRemito}
        onUpdate={updateRemito}
        onBack={() => {
          setViewMode("browser");
          setActiveRemito(null);
        }}
      />
    );
  }

  return (
    <div>
      {/* Botón para cambiar a múltiples remitos */}
      <button
        onClick={() => setRemitosMode("multiple")}
        className="mb-4 bg-gradient-to-r from-rose-primary to-rose-deep hover:from-rose-deep hover:to-ink-primary text-white py-3 px-6 rounded-lg font-bold transition shadow-lg hover:shadow-xl flex items-center gap-2"
      >
        🔴 REMITOS EN VIVO (Para TikTok Live)
      </button>
      <RemitoBrowser
        remitos={remitos}
        onCreateNew={createNewRemito}
        onEdit={(remito) => {
          setActiveRemito(remito);
          setViewMode("editor");
        }}
        onDelete={deleteRemito}
        onViewPDF={(remito) => {
          setActiveRemito(remito);
          setViewMode("editor");
        }}
      />
    </div>
  );
}
