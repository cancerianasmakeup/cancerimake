"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { Save, ArrowLeft, Plus, X, Image as ImageIcon, Trash2, Video as VideoIcon, Play, GripVertical, Package, ScanBarcode } from "lucide-react";
import { toast } from "sonner";
import Link from "next/link";
import { createSupabaseBrowser, getCurrentStoreClient } from "@/lib/supabase-browser";
import type { Category, Product, WholesaleTier } from "@cancerianas/shared";
import { formatPrice, wholesaleTierInfo, sanitizeWholesaleTiers } from "@cancerianas/shared";
import { useConfirm } from "@/components/ConfirmDialog";

type VariantDraft = {
  _key: string;
  id?: string;
  name: string;
  color_hex: string;
  price_diff: number;
  stock: number;
  sku: string;
  image_url: string;
  saving: boolean;
};

export default function ProductForm({ productId }: { productId?: string }) {
  const supabase = createSupabaseBrowser();
  const confirm = useConfirm();
  const router = useRouter();
  const [categories, setCategories] = useState<Category[]>([]);
  const [selectedCategoryIds, setSelectedCategoryIds] = useState<string[]>([]);
  const [primaryCategoryId, setPrimaryCategoryId] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const [uploading, setUploading] = useState(false);
  const [uploadingVariantKey, setUploadingVariantKey] = useState<string | null>(null);
  const [variants, setVariants] = useState<VariantDraft[]>([]);
  const [hasVariants, setHasVariants] = useState(false);
  // Drag & drop reorder de imágenes
  const [dragImgIdx, setDragImgIdx] = useState<number | null>(null);
  const [overImgIdx, setOverImgIdx] = useState<number | null>(null);
  const [form, setForm] = useState<Partial<Product> & { videos?: string[]; wholesale_tiers?: WholesaleTier[] }>({
    name: "",
    slug: "",
    description: "",
    category_id: null,
    price: 0,
    compare_price: null,
    cost: 0,
    stock: 0,
    sku: "",
    barcode: "",
    images: [],
    videos: [],
    wholesale_tiers: [],
    status: "draft",
    is_featured: false,
  });

  const variantsActive = hasVariants && variants.length > 0;
  const variantsStockTotal = variants.reduce((sum, v) => sum + (Number(v.stock) || 0), 0);
  // Cuando hay variantes activas, el stock general es derivado (suma de variantes).
  // No lo guardamos en form.stock para evitar carreras con la carga inicial; se calcula
  // al renderizar el input y al armar el payload en handleSubmit.
  const displayedStock = variantsActive ? variantsStockTotal : Number(form.stock ?? 0);

  useEffect(() => {
    supabase.from("categories").select("*").order("display_order").then(({ data }) => {
      setCategories((data as Category[]) ?? []);
    });

    if (productId) {
      supabase.from("products").select("*").eq("id", productId).single().then(({ data }) => {
        if (data) setForm(data);
      });

      supabase
        .from("product_categories")
        .select("category_id, is_primary")
        .eq("product_id", productId)
        .then(({ data }) => {
          if (data && data.length > 0) {
            setSelectedCategoryIds(data.map((r) => r.category_id));
            const primary = data.find((r) => r.is_primary);
            setPrimaryCategoryId(primary?.category_id ?? data[0].category_id);
          }
        });

      supabase
        .from("product_variants")
        .select("*")
        .eq("product_id", productId)
        .order("created_at")
        .then(({ data }) => {
          if (data && data.length > 0) {
            setHasVariants(true);
            setVariants(
              data.map((v) => ({
                _key: v.id,
                id: v.id,
                name: v.name,
                color_hex: (v.attributes?.color_hex as string) || "",
                price_diff: v.price_diff,
                stock: v.stock,
                sku: v.sku || "",
                image_url: v.image_url || "",
                saving: false,
              }))
            );
          }
        });
    }
  }, [productId]);

  function generateSlug(name: string) {
    return name
      .toLowerCase()
      .normalize("NFD")
      .replace(/[\u0300-\u036f]/g, "")
      .replace(/[^a-z0-9]+/g, "-")
      .replace(/^-|-$/g, "");
  }

  async function handleImageUpload(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    if (!file) return;
    setUploading(true);
    try {
      const body = new FormData();
      body.append("file", file);

      const res = await fetch("/api/admin/uploads/product-image", {
        method: "POST",
        headers: { "x-store-id": getCurrentStoreClient().id },
        body,
      });

      const json = await res.json().catch(() => ({}));
      if (!res.ok) throw new Error(json?.error || "No se pudo subir la imagen");

      const publicUrl = json?.url as string | undefined;
      if (!publicUrl) throw new Error("No se recibió URL pública de la imagen");

      setForm({ ...form, images: [...(form.images ?? []), publicUrl] });
      toast.success("Imagen subida");
    } catch (e: any) {
      toast.error(e.message);
    } finally {
      setUploading(false);
    }
  }

  function reorderImage(from: number, to: number) {
    if (from === to) return;
    const arr = [...(form.images ?? [])];
    const [moved] = arr.splice(from, 1);
    arr.splice(to, 0, moved);
    setForm({ ...form, images: arr });
  }

  function moveImage(i: number, delta: number) {
    const arr = [...(form.images ?? [])];
    const target = i + delta;
    if (target < 0 || target >= arr.length) return;
    [arr[i], arr[target]] = [arr[target], arr[i]];
    setForm({ ...form, images: arr });
  }

  // ===== PRECIOS POR MAYOR HELPERS =====
  const wholesaleTiers = form.wholesale_tiers ?? [];

  function updateTier(i: number, patch: Partial<WholesaleTier>) {
    setForm((prev) => ({
      ...prev,
      wholesale_tiers: (prev.wholesale_tiers ?? []).map((t, idx) => (idx === i ? { ...t, ...patch } : t)),
    }));
  }

  function addTier() {
    setForm((prev) => ({
      ...prev,
      wholesale_tiers: [...(prev.wholesale_tiers ?? []), { label: "", units: 0, price: 0 }],
    }));
  }

  function removeTier(i: number) {
    setForm((prev) => ({
      ...prev,
      wholesale_tiers: (prev.wholesale_tiers ?? []).filter((_, idx) => idx !== i),
    }));
  }

  // ===== VARIANT HELPERS =====
  function updateVariant(i: number, patch: Partial<VariantDraft>) {
    setVariants((prev) => prev.map((v, idx) => (idx === i ? { ...v, ...patch } : v)));
  }

  function addVariantRow() {
    setVariants((prev) => [
      ...prev,
      { _key: `new-${Date.now()}`, name: "", color_hex: "#f0d5aa", price_diff: 0, stock: 0, sku: "", image_url: "", saving: false },
    ]);
  }

  async function saveVariant(i: number) {
    if (!productId) {
      toast.error("Guardá el producto principal primero");
      return;
    }
    const v = variants[i];
    if (!v.name.trim()) {
      toast.error("El nombre de la variante es obligatorio");
      return;
    }
    updateVariant(i, { saving: true });

    const attrs: Record<string, string> = {};
    if (v.color_hex) attrs.color_hex = v.color_hex;

    const payload = {
      product_id: productId,
      name: v.name.trim(),
      attributes: attrs,
      price_diff: v.price_diff,
      stock: v.stock,
      sku: v.sku || null,
      image_url: v.image_url || null,
    };

    try {
      if (v.id) {
        const { error } = await supabase.from("product_variants").update(payload).eq("id", v.id);
        if (error) throw error;
      } else {
        const { data, error } = await supabase.from("product_variants").insert(payload).select().single();
        if (error) throw error;
        updateVariant(i, { id: data.id, _key: data.id });
      }
      toast.success(`Variante "${v.name.trim()}" guardada 🌸`);
    } catch (e: any) {
      toast.error(e.message);
    } finally {
      updateVariant(i, { saving: false });
    }
  }

  async function uploadVariantImage(i: number, file: File) {
    const v = variants[i];
    setUploadingVariantKey(v._key);
    try {
      const body = new FormData();
      body.append("file", file);
      const res = await fetch("/api/admin/uploads/product-image", {
        method: "POST",
        headers: { "x-store-id": getCurrentStoreClient().id },
        body,
      });
      const json = await res.json().catch(() => ({}));
      if (!res.ok) throw new Error(json?.error || "No se pudo subir la imagen");
      updateVariant(i, { image_url: json.url });
      toast.success("Imagen de variante subida");
    } catch (e: any) {
      toast.error(e.message);
    } finally {
      setUploadingVariantKey(null);
    }
  }

  async function deleteVariant(i: number) {
    const v = variants[i];
    if (v.id) {
      const ok = await confirm({
        title: `¿Eliminar la variante "${v.name}"?`,
        description: "Esta acción no se puede deshacer.",
        confirmLabel: "Sí, eliminar",
        tone: "danger",
      });
      if (!ok) return;
      const { error } = await supabase.from("product_variants").delete().eq("id", v.id);
      if (error) { toast.error(error.message); return; }
    }
    setVariants((prev) => prev.filter((_, idx) => idx !== i));
    if (v.id) toast.success("Variante eliminada");
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!form.name || !form.price) {
      toast.error("Faltan campos obligatorios");
      return;
    }
    setLoading(true);
    try {
      const payload = {
        ...form,
        category_id: primaryCategoryId, // mantenido por backward-compat (también lo sincroniza el trigger)
        slug: form.slug || generateSlug(form.name!),
        price: Number(form.price),
        compare_price: form.compare_price ? Number(form.compare_price) : null,
        cost: Number(form.cost ?? 0),
        stock: variantsActive ? variantsStockTotal : Number(form.stock ?? 0),
        // Vacío = sin código. Va NULL para que el índice único parcial deje
        // convivir muchos productos sin código de barras cargado.
        barcode: (form.barcode ?? "").trim() || null,
        videos: form.videos ?? [],
        wholesale_tiers: sanitizeWholesaleTiers(form.wholesale_tiers ?? []),
      };

      // Si todavía no se corrió la migración del código de barras, guardamos
      // igual el resto del producto en vez de romper el alta/edición entera.
      const missingBarcodeColumn = (err: any) =>
        err?.code === "PGRST204" || /barcode/i.test(String(err?.message ?? ""));
      const withoutBarcode = () => {
        const { barcode, ...rest } = payload;
        return rest;
      };

      let savedId = productId;
      if (productId) {
        let { error } = await supabase.from("products").update(payload).eq("id", productId);
        if (error && error.code !== "23505" && missingBarcodeColumn(error)) {
          toast.warning("Falta correr la migración del código de barras — guardé el resto");
          ({ error } = await supabase.from("products").update(withoutBarcode()).eq("id", productId));
        }
        if (error) throw error;
      } else {
        let { data, error } = await supabase.from("products").insert(payload).select().single();
        if (error && error.code !== "23505" && missingBarcodeColumn(error)) {
          toast.warning("Falta correr la migración del código de barras — guardé el resto");
          ({ data, error } = await supabase.from("products").insert(withoutBarcode()).select().single());
        }
        if (error) throw error;
        savedId = data!.id;
      }

      if (savedId) {
        await supabase.from("product_categories").delete().eq("product_id", savedId);
        if (selectedCategoryIds.length > 0) {
          const rows = selectedCategoryIds.map((cid) => ({
            product_id: savedId!,
            category_id: cid,
            is_primary: cid === primaryCategoryId,
          }));
          const { error: pcErr } = await supabase.from("product_categories").insert(rows);
          if (pcErr) throw pcErr;
        }
      }

      if (productId) {
        toast.success("Producto actualizado 🌸");
      } else {
        toast.success("Producto creado 🌸");
        router.replace(`/admin/products/${savedId}`);
      }
    } catch (e: any) {
      if (e?.code === "23505" && String(e?.message ?? "").includes("barcode")) {
        toast.error("Ese código de barras ya está cargado en otro producto");
      } else {
        toast.error(e.message);
      }
    } finally {
      setLoading(false);
    }
  }

  async function handleDelete() {
    if (!productId) return;
    const ok = await confirm({
      title: "¿Eliminar este producto?",
      description: "El producto se archiva (no se borra definitivamente). Podés restaurarlo después.",
      confirmLabel: "Sí, eliminar",
      tone: "danger",
    });
    if (!ok) return;
    await supabase.from("products").update({ status: "archived" }).eq("id", productId);
    toast.success("Producto archivado");
    router.push("/admin/products");
  }

  return (
    <form onSubmit={handleSubmit} className="max-w-4xl">
      <div className="flex items-center gap-4 mb-8">
        <Link href="/admin/products" className="p-2 hover:bg-rose-pastel rounded-full">
          <ArrowLeft className="w-5 h-5" />
        </Link>
        <h1 className="font-display text-3xl text-ink-primary flex-1">
          {productId ? "Editar producto" : "Nuevo producto"}
        </h1>
        {productId && (
          <button type="button" onClick={handleDelete} className="text-error text-sm hover:underline">
            Archivar
          </button>
        )}
        <button type="submit" disabled={loading} className="btn-primary">
          <Save className="w-4 h-4" /> {loading ? "Guardando..." : "Guardar"}
        </button>
      </div>

      <div className="grid md:grid-cols-3 gap-6">
        <div className="md:col-span-2 space-y-6">
          <div className="card space-y-4">
            <div>
              <label className="text-sm font-semibold text-ink-primary mb-1 block">Nombre *</label>
              <input
                className="input"
                value={form.name ?? ""}
                onChange={(e) => setForm({ ...form, name: e.target.value })}
                required
              />
            </div>
            <div>
              <label className="text-sm font-semibold text-ink-primary mb-1 block">Slug (URL)</label>
              <input
                className="input"
                value={form.slug ?? ""}
                onChange={(e) => setForm({ ...form, slug: e.target.value })}
                placeholder="se-genera-automatico-si-lo-dejas-vacio"
              />
            </div>
            <div>
              <label className="text-sm font-semibold text-ink-primary mb-1 block">Descripción</label>
              <textarea
                className="input min-h-32"
                value={form.description ?? ""}
                onChange={(e) => setForm({ ...form, description: e.target.value })}
              />
            </div>
          </div>

          <div className="card space-y-4">
            <div className="flex items-center justify-between flex-wrap gap-2">
              <h3 className="font-display text-lg">Imágenes</h3>
              {(form.images ?? []).length > 1 && (
                <p className="text-xs text-ink-soft inline-flex items-center gap-1">
                  <GripVertical className="w-3.5 h-3.5" /> Arrastrá para reordenar — la #1 es la portada
                </p>
              )}
            </div>
            <div className="grid grid-cols-3 gap-3">
              {(form.images ?? []).map((img, i) => {
                const isDragging = dragImgIdx === i;
                const isOver = overImgIdx === i && dragImgIdx !== null && dragImgIdx !== i;
                return (
                  <div
                    key={img + i}
                    draggable
                    onDragStart={(e) => {
                      setDragImgIdx(i);
                      e.dataTransfer.effectAllowed = "move";
                    }}
                    onDragEnd={() => {
                      setDragImgIdx(null);
                      setOverImgIdx(null);
                    }}
                    onDragOver={(e) => {
                      e.preventDefault();
                      e.dataTransfer.dropEffect = "move";
                      if (overImgIdx !== i) setOverImgIdx(i);
                    }}
                    onDrop={(e) => {
                      e.preventDefault();
                      if (dragImgIdx !== null) reorderImage(dragImgIdx, i);
                      setDragImgIdx(null);
                      setOverImgIdx(null);
                    }}
                    className={`relative aspect-square rounded-2xl overflow-hidden bg-rose-pastel group cursor-grab active:cursor-grabbing transition-all ${
                      isDragging ? "opacity-40 scale-95" : ""
                    } ${isOver ? "ring-2 ring-rose-deep ring-offset-2" : ""}`}
                  >
                    <img src={img} alt="" className="w-full h-full object-cover pointer-events-none" />

                    {/* Badge de posición (#1 = portada) */}
                    <span
                      className={`absolute top-2 left-2 text-white text-[11px] font-black w-6 h-6 rounded-full flex items-center justify-center shadow-md ${
                        i === 0 ? "bg-rose-deep" : "bg-ink-primary/80"
                      }`}
                      title={i === 0 ? "Portada" : `Posición ${i + 1}`}
                    >
                      {i + 1}
                    </span>

                    {/* Grip handle (visual hint) */}
                    <span className="absolute top-2 right-9 bg-white/90 backdrop-blur p-1 rounded-md text-ink-soft opacity-0 group-hover:opacity-100 transition pointer-events-none">
                      <GripVertical className="w-3 h-3" />
                    </span>

                    {/* Mobile-friendly arrows */}
                    <div className="absolute bottom-2 left-2 flex gap-1 opacity-0 group-hover:opacity-100 transition">
                      {i > 0 && (
                        <button
                          type="button"
                          onClick={(e) => { e.preventDefault(); moveImage(i, -1); }}
                          className="bg-white/95 backdrop-blur text-ink-primary w-6 h-6 rounded-md text-xs font-bold flex items-center justify-center shadow hover:bg-rose-whisper"
                          title="Mover atrás"
                          aria-label="Mover atrás"
                        >
                          ←
                        </button>
                      )}
                      {i < (form.images?.length ?? 0) - 1 && (
                        <button
                          type="button"
                          onClick={(e) => { e.preventDefault(); moveImage(i, +1); }}
                          className="bg-white/95 backdrop-blur text-ink-primary w-6 h-6 rounded-md text-xs font-bold flex items-center justify-center shadow hover:bg-rose-whisper"
                          title="Mover adelante"
                          aria-label="Mover adelante"
                        >
                          →
                        </button>
                      )}
                    </div>

                    <button
                      type="button"
                      onClick={() => setForm({ ...form, images: form.images!.filter((_, idx) => idx !== i) })}
                      className="absolute top-2 right-2 bg-error text-white p-1 rounded-full opacity-0 group-hover:opacity-100 transition"
                      title="Quitar imagen"
                    >
                      <X className="w-3 h-3" />
                    </button>
                  </div>
                );
              })}
              <label className="aspect-square rounded-2xl border-2 border-dashed border-rose-medium flex flex-col items-center justify-center gap-1 cursor-pointer hover:bg-rose-whisper">
                <ImageIcon className="w-6 h-6 text-rose-deep" />
                <span className="text-xs text-ink-soft">{uploading ? "Subiendo..." : "Agregar"}</span>
                <input type="file" className="hidden" accept="image/*" onChange={handleImageUpload} disabled={uploading} />
              </label>
            </div>
            <p className="text-xs text-ink-soft">
              Las imágenes se suben al bucket "products" de Supabase Storage. Asegurate de crear ese bucket público.
            </p>
            <input
              className="input text-sm"
              placeholder="O pegá una URL directa"
              onKeyDown={(e) => {
                if (e.key === "Enter") {
                  e.preventDefault();
                  const url = (e.target as HTMLInputElement).value;
                  if (url) {
                    setForm({ ...form, images: [...(form.images ?? []), url] });
                    (e.target as HTMLInputElement).value = "";
                  }
                }
              }}
            />
          </div>

          {/* Precios por mayor */}
          <div className="card space-y-4">
            <div className="flex items-center gap-2">
              <Package className="w-5 h-5 text-rose-deep" />
              <h3 className="font-display text-lg">Precios por mayor</h3>
            </div>
            <p className="text-xs text-ink-soft">
              Ofrecé packs con más unidades a un precio con descuento (ej: <strong>3 unidades</strong>,{" "}
              <strong>media caja</strong>, <strong>caja</strong>). La clienta los elige como botones en la
              página del producto y ve el precio tachado con el % de descuento. Se descuenta del mismo stock.
            </p>

            {hasVariants && wholesaleTiers.length > 0 && (
              <p className="text-xs text-ink-secondary bg-rose-whisper border border-rose-pastel rounded-xl px-3 py-2">
                💡 Este producto tiene variantes. Al elegir un pack, la clienta reparte esas unidades entre las
                variantes con stock (ej: 2 de un tono + 1 de otro). El precio del pack es fijo para esa cantidad.
              </p>
            )}

            {wholesaleTiers.length > 0 && (
              <div className="space-y-3">
                {wholesaleTiers.map((t, i) => {
                  const base = Number(form.price ?? 0);
                  const info = wholesaleTierInfo(
                    { label: t.label, units: Number(t.units) || 0, price: Number(t.price) || 0 },
                    base
                  );
                  const validRow = (Number(t.units) || 0) > 0 && (Number(t.price) || 0) > 0;
                  const noDiscount = validRow && info.savings <= 0;
                  return (
                    <div key={i} className="border border-rose-pastel rounded-2xl p-3 space-y-3 bg-rose-whisper/40">
                      <div className="flex flex-wrap items-end gap-3">
                        <div className="flex-1 min-w-[140px]">
                          <label className="text-xs text-ink-soft block mb-1">Nombre del pack</label>
                          <input
                            className="input text-sm"
                            placeholder="Ej: 3 unidades, Media caja…"
                            value={t.label}
                            onChange={(e) => updateTier(i, { label: e.target.value })}
                          />
                        </div>
                        <div className="w-24">
                          <label className="text-xs text-ink-soft block mb-1">Unidades</label>
                          <input
                            type="number"
                            min="1"
                            className="input text-sm text-center"
                            placeholder="3"
                            onFocus={(e) => e.target.select()}
                            value={t.units || ""}
                            onChange={(e) => updateTier(i, { units: Number(e.target.value) })}
                          />
                        </div>
                        <div className="w-32">
                          <label className="text-xs text-ink-soft block mb-1">Precio del pack</label>
                          <div className="relative">
                            <span className="absolute left-3 top-1/2 -translate-y-1/2 text-ink-soft text-sm pointer-events-none">$</span>
                            <input
                              type="number"
                              min="0"
                              className="input text-sm text-right pl-7"
                              placeholder="8500"
                              onFocus={(e) => e.target.select()}
                              value={t.price || ""}
                              onChange={(e) => updateTier(i, { price: Number(e.target.value) })}
                            />
                          </div>
                        </div>
                        <button
                          type="button"
                          onClick={() => removeTier(i)}
                          className="flex-shrink-0 p-2 text-error hover:bg-error/10 rounded-full transition mb-0.5"
                          title="Quitar pack"
                          aria-label="Quitar pack"
                        >
                          <Trash2 className="w-4 h-4" />
                        </button>
                      </div>

                      {/* Preview del descuento */}
                      {validRow ? (
                        noDiscount ? (
                          <p className="text-xs text-warning">
                            Este pack no tiene descuento respecto al precio unitario ({formatPrice(base)} c/u).
                            Bajá el precio del pack para que convenga.
                          </p>
                        ) : (
                          <div className="flex flex-wrap items-center gap-x-3 gap-y-1 text-xs">
                            <span className="text-ink-soft">
                              Precio normal:{" "}
                              <span className="line-through">{formatPrice(info.regularTotal)}</span>
                            </span>
                            <span className="font-semibold text-rose-deep">
                              {formatPrice(info.price)} el pack
                            </span>
                            <span className="text-ink-soft">≈ {formatPrice(info.unitPrice)} c/u</span>
                            <span className="bg-rose-deep text-white font-bold rounded-full px-2 py-0.5">
                              -{info.discountPct}%
                            </span>
                          </div>
                        )
                      ) : (
                        <p className="text-xs text-ink-soft">Completá unidades y precio para ver el descuento.</p>
                      )}
                    </div>
                  );
                })}
              </div>
            )}

            <button
              type="button"
              onClick={addTier}
              className="flex items-center gap-2 text-sm text-rose-deep font-medium hover:underline"
            >
              <Plus className="w-4 h-4" /> Agregar opción de compra por mayor
            </button>
          </div>

          {/* Videos */}
          <div className="card space-y-4">
            <div className="flex items-center gap-2">
              <VideoIcon className="w-5 h-5 text-rose-deep" />
              <h3 className="font-display text-lg">Videos del producto</h3>
            </div>
            <p className="text-xs text-ink-soft">
              Pegá la URL de un video (.mp4 / .webm subido a R2, Cloudinary, etc).
              Aparece en el carrusel del detalle del producto.
            </p>

            {(form.videos ?? []).length > 0 && (
              <div className="grid grid-cols-3 gap-3">
                {(form.videos ?? []).map((vid, i) => (
                  <div key={i} className="relative aspect-square rounded-2xl overflow-hidden bg-ink-primary/90 group">
                    <video
                      src={vid}
                      className="w-full h-full object-cover"
                      muted
                      playsInline
                      preload="metadata"
                    />
                    <span className="absolute inset-0 flex items-center justify-center bg-black/40 pointer-events-none">
                      <Play className="w-7 h-7 text-white fill-white" />
                    </span>
                    <button
                      type="button"
                      onClick={() =>
                        setForm({
                          ...form,
                          videos: (form.videos ?? []).filter((_, idx) => idx !== i),
                        })
                      }
                      className="absolute top-2 right-2 bg-error text-white p-1 rounded-full opacity-0 group-hover:opacity-100 transition"
                      aria-label="Quitar video"
                    >
                      <X className="w-3 h-3" />
                    </button>
                  </div>
                ))}
              </div>
            )}

            <input
              className="input text-sm"
              placeholder="https://… .mp4 (pegá la URL y dale Enter)"
              onKeyDown={(e) => {
                if (e.key === "Enter") {
                  e.preventDefault();
                  const url = (e.target as HTMLInputElement).value.trim();
                  if (url) {
                    setForm({ ...form, videos: [...(form.videos ?? []), url] });
                    (e.target as HTMLInputElement).value = "";
                  }
                }
              }}
            />
          </div>
        </div>

        <div className="space-y-6">
          <div className="card space-y-4">
            <div>
              <label className="text-sm font-semibold text-ink-primary mb-1 block">Estado</label>
              <select
                className="input"
                value={form.status ?? "draft"}
                onChange={(e) => setForm({ ...form, status: e.target.value as any })}
              >
                <option value="draft">Borrador</option>
                <option value="active">Activo (visible)</option>
                <option value="archived">Archivado</option>
              </select>
            </div>
            <div>
              <label className="text-sm font-semibold text-ink-primary mb-1 block">
                Categorías
              </label>
              <p className="text-xs text-ink-soft mb-2">
                Marcá una o varias. La marcada como <strong>★ Principal</strong> es la que se usa
                para breadcrumbs y productos relacionados.
              </p>
              <div className="space-y-1.5 max-h-64 overflow-y-auto pr-1">
                {categories.map((c) => {
                  const checked = selectedCategoryIds.includes(c.id);
                  const isPrimary = primaryCategoryId === c.id;
                  return (
                    <label
                      key={c.id}
                      className={`flex items-center gap-2 px-2 py-1.5 rounded-lg cursor-pointer transition ${
                        checked ? "bg-rose-whisper" : "hover:bg-rose-pastel/40"
                      }`}
                    >
                      <input
                        type="checkbox"
                        className="w-4 h-4 accent-rose-deep"
                        checked={checked}
                        onChange={(e) => {
                          if (e.target.checked) {
                            setSelectedCategoryIds((prev) => [...prev, c.id]);
                            if (!primaryCategoryId) setPrimaryCategoryId(c.id);
                          } else {
                            setSelectedCategoryIds((prev) => prev.filter((id) => id !== c.id));
                            if (primaryCategoryId === c.id) {
                              const remaining = selectedCategoryIds.filter(
                                (id) => id !== c.id
                              );
                              setPrimaryCategoryId(remaining[0] ?? null);
                            }
                          }
                        }}
                      />
                      <span className="text-sm flex-1">{c.name}</span>
                      {checked && (
                        <button
                          type="button"
                          onClick={(e) => {
                            e.preventDefault();
                            setPrimaryCategoryId(c.id);
                          }}
                          className={`text-xs px-2 py-0.5 rounded-full transition ${
                            isPrimary
                              ? "bg-rose-deep text-white"
                              : "border border-rose-medium text-rose-deep hover:bg-rose-pastel"
                          }`}
                          title={isPrimary ? "Categoría principal" : "Marcar como principal"}
                        >
                          {isPrimary ? "★ Principal" : "Marcar"}
                        </button>
                      )}
                    </label>
                  );
                })}
              </div>
            </div>
            <label className="flex items-center gap-2 cursor-pointer">
              <input
                type="checkbox"
                checked={form.is_featured ?? false}
                onChange={(e) => setForm({ ...form, is_featured: e.target.checked })}
                className="w-4 h-4 accent-rose-deep"
              />
              <span className="text-sm">Destacado en la home</span>
            </label>
          </div>

          <div className="card space-y-4">
            <h3 className="font-display text-lg">Precio y stock</h3>
            <div>
              <label className="text-sm font-semibold text-ink-primary mb-1 block">Precio (ARS) *</label>
              <div className="relative">
                <span className="absolute left-3 top-1/2 -translate-y-1/2 text-ink-soft pointer-events-none">$</span>
                <input
                  type="number"
                  className="input pl-7"
                  value={form.price ?? 0}
                  onFocus={(e) => e.target.select()}
                  onChange={(e) => setForm({ ...form, price: Number(e.target.value) })}
                  required
                />
              </div>
            </div>
            <div>
              <label className="text-sm font-semibold text-ink-primary mb-1 block">Precio comparativo (tachado)</label>
              <div className="relative">
                <span className="absolute left-3 top-1/2 -translate-y-1/2 text-ink-soft pointer-events-none">$</span>
                <input
                  type="number"
                  className="input pl-7"
                  value={form.compare_price ?? ""}
                  onFocus={(e) => e.target.select()}
                  onChange={(e) => setForm({ ...form, compare_price: e.target.value ? Number(e.target.value) : null })}
                  placeholder="Opcional"
                />
              </div>
            </div>
            <div>
              <label className="text-sm font-semibold text-ink-primary mb-1 block">Stock</label>
              <input
                type="number"
                className={`input ${variantsActive ? "bg-rose-pastel/40 cursor-not-allowed" : ""}`}
                value={displayedStock}
                onFocus={(e) => e.target.select()}
                onChange={(e) => setForm({ ...form, stock: Number(e.target.value) })}
                readOnly={variantsActive}
                disabled={variantsActive}
                title={variantsActive ? "Con variantes activas, el stock se calcula automáticamente sumando el stock de cada variante." : undefined}
              />
              {variantsActive && (
                <p className="text-xs text-ink-soft mt-1">
                  Auto: suma de {variants.length} variante{variants.length !== 1 ? "s" : ""}. Editá el stock en cada variante abajo.
                </p>
              )}
            </div>
            <div>
              <label className="text-sm font-semibold text-ink-primary mb-1 block">Precio de costo (ARS)</label>
              <div className="relative">
                <span className="absolute left-3 top-1/2 -translate-y-1/2 text-ink-soft pointer-events-none">$</span>
                <input
                  type="number"
                  className="input pl-7"
                  value={form.cost ?? 0}
                  onFocus={(e) => e.target.select()}
                  onChange={(e) => setForm({ ...form, cost: Number(e.target.value) })}
                  placeholder="Solo visible para vos"
                />
              </div>
            </div>
            <div>
              <label className="text-sm font-semibold text-ink-primary mb-1 block">SKU</label>
              <input
                className="input"
                value={form.sku ?? ""}
                onChange={(e) => setForm({ ...form, sku: e.target.value })}
                placeholder="Opcional"
              />
            </div>
            <div>
              <label className="text-sm font-semibold text-ink-primary mb-1 flex items-center gap-1.5">
                <ScanBarcode className="w-4 h-4 text-rose-deep" />
                Código de barras
              </label>
              <input
                className="input font-mono tracking-wider"
                value={form.barcode ?? ""}
                onFocus={(e) => e.target.select()}
                onChange={(e) => setForm({ ...form, barcode: e.target.value })}
                onKeyDown={(e) => {
                  // La pistola lectora termina con Enter: acá no queremos que
                  // eso mande el formulario, solo que confirme el campo.
                  if (e.key === "Enter") {
                    e.preventDefault();
                    (e.target as HTMLInputElement).blur();
                  }
                }}
                placeholder="Escaneá el código acá (o escribilo)"
                autoComplete="off"
              />
              <p className="text-xs text-ink-soft mt-1">
                Hacé clic en el campo y disparás con la pistola. Con esto el producto se
                carga solo al armar presupuestos.
              </p>
            </div>
          </div>
        </div>
      </div>

      {/* ===== VARIANTES ===== */}
      <div className="mt-8 space-y-4">
        <div className="flex items-center justify-between flex-wrap gap-3">
          <h2 className="font-display text-2xl text-ink-primary">Variantes del producto</h2>
          <label className="flex items-center gap-2 cursor-pointer select-none text-sm text-ink-soft">
            <input
              type="checkbox"
              className="w-4 h-4 accent-rose-deep"
              checked={hasVariants}
              onChange={(e) => setHasVariants(e.target.checked)}
            />
            Este producto tiene variantes (colores, tonos, talles…)
          </label>
        </div>

        {hasVariants && (
          <div className="card space-y-5">
            <p className="text-xs text-ink-soft bg-rose-whisper rounded-xl px-4 py-2">
              💡 Hacé clic en el círculo de color para abrir el selector de colores. En{" "}
              <strong>Chrome/Edge</strong> aparece un gotero (🖱 eyedropper) para copiar un color
              directamente de la pantalla — útil para tomar colores de la web oficial de la marca.
            </p>

            {variants.map((v, i) => (
              <div key={v._key} className="border border-rose-pastel rounded-2xl p-4 space-y-3">
                <div className="flex items-center gap-3">
                  {/* Color swatch / picker */}
                  <div
                    className="relative flex-shrink-0 w-10 h-10 cursor-pointer"
                    title="Clic para elegir color (Chrome/Edge: usá el gotero)"
                  >
                    <div
                      className="w-10 h-10 rounded-full border-2 border-rose-pastel shadow"
                      style={{ backgroundColor: v.color_hex || "#e5e5e5" }}
                    />
                    <input
                      type="color"
                      className="absolute inset-0 opacity-0 w-full h-full cursor-pointer rounded-full"
                      value={v.color_hex || "#e5e5e5"}
                      onChange={(e) => updateVariant(i, { color_hex: e.target.value })}
                    />
                  </div>

                  {/* Name */}
                  <input
                    className="input flex-1 text-sm"
                    placeholder="Nombre (ej: Tono 01, Rosa, Talle M…)"
                    value={v.name}
                    onChange={(e) => updateVariant(i, { name: e.target.value })}
                  />

                  {/* Stock badge */}
                  <div className="flex-shrink-0 text-center">
                    <label className="text-xs text-ink-soft block mb-0.5">Stock</label>
                    <input
                      type="number"
                      min="0"
                      className={`input w-20 text-sm text-center font-bold ${
                        v.stock === 0 ? "border-error/50 text-error" : "text-ink-primary"
                      }`}
                      value={v.stock}
                      onFocus={(e) => e.target.select()}
                      onChange={(e) => updateVariant(i, { stock: Number(e.target.value) })}
                    />
                  </div>

                  {/* Delete */}
                  <button
                    type="button"
                    onClick={() => deleteVariant(i)}
                    className="flex-shrink-0 p-2 text-error hover:bg-error/10 rounded-full transition"
                    title="Eliminar variante"
                  >
                    <Trash2 className="w-4 h-4" />
                  </button>
                </div>

                <div className="grid grid-cols-3 gap-3">
                  <div>
                    <label className="text-xs text-ink-soft block mb-1">Diferencia de precio</label>
                    <input
                      type="number"
                      className="input text-sm"
                      placeholder="0"
                      value={v.price_diff}
                      onFocus={(e) => e.target.select()}
                      onChange={(e) => updateVariant(i, { price_diff: Number(e.target.value) })}
                    />
                  </div>
                  <div>
                    <label className="text-xs text-ink-soft block mb-1">SKU</label>
                    <input
                      className="input text-sm"
                      placeholder="Opcional"
                      value={v.sku}
                      onChange={(e) => updateVariant(i, { sku: e.target.value })}
                    />
                  </div>
                  <div className="col-span-1">
                    <label className="text-xs text-ink-soft block mb-1">Imagen de variante</label>
                    <div className="flex items-center gap-2">
                      {/* Preview */}
                      {v.image_url && (
                        <div className="flex-shrink-0 w-10 h-10 rounded-xl overflow-hidden border border-rose-pastel">
                          <img src={v.image_url} alt="" className="w-full h-full object-cover" />
                        </div>
                      )}
                      {/* Upload local */}
                      <label
                        className="flex-shrink-0 cursor-pointer px-2 py-1 rounded-xl border border-dashed border-rose-medium text-xs text-rose-deep hover:bg-rose-whisper transition flex items-center gap-1"
                        title="Subir imagen local a Cloudflare R2"
                      >
                        <ImageIcon className="w-3.5 h-3.5" />
                        {uploadingVariantKey === v._key ? "Subiendo…" : "Subir"}
                        <input
                          type="file"
                          accept="image/*"
                          className="hidden"
                          disabled={uploadingVariantKey === v._key}
                          onChange={(e) => {
                            const file = e.target.files?.[0];
                            if (file) uploadVariantImage(i, file);
                          }}
                        />
                      </label>
                      {/* URL manual */}
                      <input
                        className="input text-xs flex-1 min-w-0"
                        placeholder="o pegá una URL"
                        value={v.image_url}
                        onChange={(e) => updateVariant(i, { image_url: e.target.value })}
                      />
                    </div>
                  </div>
                </div>

                <div className="flex items-center justify-between border-t border-rose-pastel pt-3">
                  {v.stock === 0 && (
                    <p className="text-xs text-error font-medium">Sin stock — el botón se deshabilitará en la tienda</p>
                  )}
                  <div className="ml-auto">
                    <button
                      type="button"
                      onClick={() => saveVariant(i)}
                      disabled={v.saving}
                      className="btn-primary text-sm px-4 py-2"
                    >
                      <Save className="w-3.5 h-3.5" />
                      {v.saving ? "Guardando..." : "Guardar variante"}
                    </button>
                  </div>
                </div>
              </div>
            ))}

            {variants.length > 0 && (
              <div className="flex items-center justify-between text-sm border-t border-rose-pastel pt-3">
                <p className="text-ink-soft">
                  Stock total:{" "}
                  <span className="font-bold text-ink-primary">
                    {variants.reduce((sum, v) => sum + (v.stock || 0), 0)} unidades
                  </span>{" "}
                  en {variants.length} variante{variants.length !== 1 ? "s" : ""}
                </p>
                <p className="text-xs text-ink-soft">
                  Las variantes con stock 0 se muestran deshabilitadas en la tienda
                </p>
              </div>
            )}

            <button
              type="button"
              onClick={addVariantRow}
              className="flex items-center gap-2 text-sm text-rose-deep font-medium hover:underline"
            >
              <Plus className="w-4 h-4" /> Agregar variante
            </button>
          </div>
        )}
      </div>
    </form>
  );
}
