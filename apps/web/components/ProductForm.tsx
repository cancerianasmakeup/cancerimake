"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { Save, ArrowLeft, Plus, X, Image as ImageIcon, Trash2, Video as VideoIcon, Play, GripVertical } from "lucide-react";
import { toast } from "sonner";
import Link from "next/link";
import { createSupabaseBrowser } from "@/lib/supabase-browser";
import type { Category, Product } from "@cancerianas/shared";
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
  const [loading, setLoading] = useState(false);
  const [uploading, setUploading] = useState(false);
  const [uploadingVariantKey, setUploadingVariantKey] = useState<string | null>(null);
  const [variants, setVariants] = useState<VariantDraft[]>([]);
  const [hasVariants, setHasVariants] = useState(false);
  // Drag & drop reorder de imágenes
  const [dragImgIdx, setDragImgIdx] = useState<number | null>(null);
  const [overImgIdx, setOverImgIdx] = useState<number | null>(null);
  const [form, setForm] = useState<Partial<Product> & { videos?: string[] }>({
    name: "",
    slug: "",
    description: "",
    category_id: null,
    price: 0,
    compare_price: null,
    cost: 0,
    stock: 0,
    sku: "",
    images: [],
    videos: [],
    status: "draft",
    is_featured: false,
  });

  useEffect(() => {
    supabase.from("categories").select("*").order("display_order").then(({ data }) => {
      setCategories((data as Category[]) ?? []);
    });

    if (productId) {
      supabase.from("products").select("*").eq("id", productId).single().then(({ data }) => {
        if (data) setForm(data);
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
      const res = await fetch("/api/admin/uploads/product-image", { method: "POST", body });
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
        slug: form.slug || generateSlug(form.name!),
        price: Number(form.price),
        compare_price: form.compare_price ? Number(form.compare_price) : null,
        cost: Number(form.cost ?? 0),
        stock: Number(form.stock),
        videos: form.videos ?? [],
      };

      if (productId) {
        const { error } = await supabase.from("products").update(payload).eq("id", productId);
        if (error) throw error;
        toast.success("Producto actualizado 🌸");
      } else {
        const { data, error } = await supabase.from("products").insert(payload).select().single();
        if (error) throw error;
        toast.success("Producto creado 🌸");
        router.replace(`/admin/products/${data.id}`);
      }
    } catch (e: any) {
      toast.error(e.message);
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
              <label className="text-sm font-semibold text-ink-primary mb-1 block">Categoría</label>
              <select
                className="input"
                value={form.category_id ?? ""}
                onChange={(e) => setForm({ ...form, category_id: e.target.value || null })}
              >
                <option value="">Sin categoría</option>
                {categories.map((c) => (
                  <option key={c.id} value={c.id}>{c.name}</option>
                ))}
              </select>
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
              <input
                type="number"
                className="input"
                value={form.price ?? 0}
                onChange={(e) => setForm({ ...form, price: Number(e.target.value) })}
                required
              />
            </div>
            <div>
              <label className="text-sm font-semibold text-ink-primary mb-1 block">Precio comparativo (tachado)</label>
              <input
                type="number"
                className="input"
                value={form.compare_price ?? ""}
                onChange={(e) => setForm({ ...form, compare_price: e.target.value ? Number(e.target.value) : null })}
                placeholder="Opcional"
              />
            </div>
            <div>
              <label className="text-sm font-semibold text-ink-primary mb-1 block">Stock</label>
              <input
                type="number"
                className="input"
                value={form.stock ?? 0}
                onChange={(e) => setForm({ ...form, stock: Number(e.target.value) })}
              />
            </div>
            <div>
              <label className="text-sm font-semibold text-ink-primary mb-1 block">Precio de costo (ARS)</label>
              <input
                type="number"
                className="input"
                value={form.cost ?? 0}
                onChange={(e) => setForm({ ...form, cost: Number(e.target.value) })}
                placeholder="Solo visible para vos"
              />
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
