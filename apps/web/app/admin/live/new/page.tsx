"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { ArrowLeft, Plus, X, Save, Sparkles } from "lucide-react";
import { toast } from "sonner";
import { createSupabaseBrowser } from "@/lib/supabase-browser";
import type { LiveEventType } from "@cancerianas/shared";

interface OfferDraft {
  name: string;
  description: string;
  price: number;
  total_stock: number;
  unit_count: number;
  image_url: string;
}

const TYPE_INFO: Record<LiveEventType, { name: string; emoji: string; tagline: string }> = {
  capsulas: { name: "Cápsulas", emoji: "💊", tagline: "Stock fijo, comprá libre mientras haya disponibilidad" },
  sobres: { name: "Sobres", emoji: "✉️", tagline: "Vos liberás los sobres uno por uno desde el panel" },
  bolsitas: { name: "Bolsitas", emoji: "🎀", tagline: "Fila por orden de llegada, vos abrís y cerrás la fila" },
};

export default function NewLiveEvent() {
  const supabase = createSupabaseBrowser();
  const router = useRouter();
  const [type, setType] = useState<LiveEventType>("capsulas");
  const [title, setTitle] = useState("");
  const [description, setDescription] = useState("");
  const [coverImage, setCoverImage] = useState("");
  const [offers, setOffers] = useState<OfferDraft[]>([
    { name: "", description: "", price: 0, total_stock: 10, unit_count: 1, image_url: "" },
  ]);
  const [saving, setSaving] = useState(false);

  function updateOffer(i: number, patch: Partial<OfferDraft>) {
    setOffers(offers.map((o, idx) => (idx === i ? { ...o, ...patch } : o)));
  }

  async function save() {
    if (!title || offers.length === 0 || offers.some(o => !o.name || o.price <= 0 || o.total_stock <= 0)) {
      toast.error("Completá título y todas las ofertas (nombre, precio y stock)");
      return;
    }

    setSaving(true);
    try {
      const { data: { user } } = await supabase.auth.getUser();
      const { data: ev, error } = await supabase
        .from("live_events")
        .insert({
          type, title, description,
          cover_image: coverImage || null,
          status: "draft",
          created_by: user?.id,
        })
        .select()
        .single();
      if (error) throw error;

      const offerRows = offers.map((o, idx) => ({
        event_id: ev.id,
        name: o.name,
        description: o.description || null,
        price: Number(o.price),
        total_stock: Number(o.total_stock),
        unit_count: Number(o.unit_count) || 1,
        image_url: o.image_url || null,
        display_order: idx,
      }));
      const { error: offerErr } = await supabase.from("live_offers").insert(offerRows);
      if (offerErr) throw offerErr;

      toast.success("Evento creado 🌸");
      router.replace(`/admin/live/${ev.id}`);
    } catch (e: any) {
      toast.error(e.message);
    } finally {
      setSaving(false);
    }
  }

  return (
    <div className="max-w-4xl">
      <div className="flex items-center gap-4 mb-8">
        <Link href="/admin/live" className="p-2 hover:bg-rose-pastel rounded-full">
          <ArrowLeft className="w-5 h-5" />
        </Link>
        <h1 className="font-display text-3xl text-ink-primary flex-1">Nuevo evento LIVE</h1>
        <button onClick={save} disabled={saving} className="btn-primary">
          <Save className="w-4 h-4" /> {saving ? "Creando..." : "Crear evento"}
        </button>
      </div>

      {/* Tipo */}
      <div className="card mb-6">
        <h3 className="font-display text-lg mb-3">Tipo de dinámica</h3>
        <div className="grid md:grid-cols-3 gap-3">
          {(Object.keys(TYPE_INFO) as LiveEventType[]).map((t) => {
            const info = TYPE_INFO[t];
            const selected = type === t;
            return (
              <button
                key={t}
                onClick={() => setType(t)}
                className={`p-4 rounded-2xl border-2 text-left transition ${
                  selected ? "border-rose-deep bg-rose-pastel" : "border-rose-pastel hover:border-rose-medium"
                }`}
              >
                <div className="text-3xl mb-2">{info.emoji}</div>
                <div className="font-display font-semibold">{info.name}</div>
                <div className="text-xs text-ink-soft mt-1">{info.tagline}</div>
              </button>
            );
          })}
        </div>
      </div>

      {/* Datos */}
      <div className="card space-y-4 mb-6">
        <div>
          <label className="text-sm font-semibold mb-1 block">Título *</label>
          <input className="input" value={title} onChange={e => setTitle(e.target.value)}
            placeholder="Ej: LIVE Sábado a la noche - Cápsulas mágicas" />
        </div>
        <div>
          <label className="text-sm font-semibold mb-1 block">Descripción</label>
          <textarea className="input min-h-20" value={description} onChange={e => setDescription(e.target.value)}
            placeholder="Contales qué va a haber en el LIVE" />
        </div>
        <div>
          <label className="text-sm font-semibold mb-1 block">Imagen de portada (URL)</label>
          <input className="input" value={coverImage} onChange={e => setCoverImage(e.target.value)} />
        </div>
      </div>

      {/* Ofertas */}
      <div className="card">
        <div className="flex items-center justify-between mb-4">
          <h3 className="font-display text-lg">{type === "sobres" ? "Sobres" : "Ofertas"}</h3>
          <button
            onClick={() => setOffers([...offers, { name: "", description: "", price: 0, total_stock: 10, unit_count: 1, image_url: "" }])}
            className="btn-secondary text-sm py-2 px-4"
          >
            <Plus className="w-4 h-4" /> Agregar
          </button>
        </div>
        <div className="space-y-4">
          {offers.map((o, i) => (
            <div key={i} className="rounded-2xl border border-rose-pastel p-4 relative">
              {offers.length > 1 && (
                <button
                  onClick={() => setOffers(offers.filter((_, idx) => idx !== i))}
                  className="absolute top-2 right-2 p-1 text-ink-soft hover:text-error"
                >
                  <X className="w-4 h-4" />
                </button>
              )}
              <div className="grid md:grid-cols-2 gap-3">
                <input className="input md:col-span-2" placeholder="Nombre" value={o.name} onChange={e => updateOffer(i, { name: e.target.value })} />
                <input className="input md:col-span-2" placeholder="Descripción (opcional)" value={o.description} onChange={e => updateOffer(i, { description: e.target.value })} />
                <input className="input" type="number" placeholder="Precio (ARS)" value={o.price || ""} onChange={e => updateOffer(i, { price: Number(e.target.value) })} />
                <input className="input" type="number" placeholder={type === "sobres" ? "Total de sobres" : "Unidades disponibles"} value={o.total_stock || ""} onChange={e => updateOffer(i, { total_stock: Number(e.target.value) })} />
                <input className="input md:col-span-2" placeholder="Imagen URL (opcional)" value={o.image_url} onChange={e => updateOffer(i, { image_url: e.target.value })} />
              </div>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}
