"use client";

import { useEffect, useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { ArrowLeft, ArrowRight, Save, Trash2 } from "lucide-react";
import { toast } from "sonner";
import { createSupabaseBrowser } from "@/lib/supabase-browser";
import type { Category } from "@cancerianas/shared";
import { useConfirm } from "@/components/ConfirmDialog";

const PRESET_EMOJIS = [
  "🌸", "🌺", "🌹", "🌷", "🌻", "🌼", "🪷", "🌿", "🍃", "🌱",
  "💗", "❤️", "🧡", "💛", "💚", "💙", "💜", "🤎", "🖤", "🤍",
  "✨", "⭐", "🌟", "💫", "🔥", "💎", "👑", "💍", "🎀", "🎁",
  "💄", "💋", "💅", "👗", "👙", "👠", "👜", "🪞", "🧴", "🛁",
  "🧖‍♀️", "🧘‍♀️", "🌙", "☁️", "🍵", "🌊", "🦋", "🐚", "🍰", "🥂",
];

type Gradient = { from: string; to: string; name: string };
const PRESET_GRADIENTS: Gradient[] = [
  { name: "Rosa deep", from: "#FF8FA3", to: "#E66B85" },
  { name: "Rosa soft", from: "#FFB3C6", to: "#FF8FA3" },
  { name: "Pastel", from: "#FFE5EC", to: "#FFB3C6" },
  { name: "Sage", from: "#A8D5A8", to: "#FFE5EC" },
  { name: "Peach", from: "#F4B4A0", to: "#FF8FA3" },
  { name: "Sunset", from: "#FFB3C6", to: "#F4B4A0" },
  { name: "Whisper", from: "#FFF0F4", to: "#FFE5EC" },
  { name: "Bold", from: "#E66B85", to: "#C04A6E" },
  { name: "Cream", from: "#FFF7F9", to: "#FFE5EC" },
  { name: "Lavender", from: "#D9B5FF", to: "#FFB3C6" },
  { name: "Mocha", from: "#D8B79C", to: "#A8765B" },
  { name: "Sky", from: "#B5E3FF", to: "#FFB3C6" },
];

function slugify(s: string) {
  return s
    .toLowerCase()
    .normalize("NFD")
    .replace(/[̀-ͯ]/g, "")
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-|-$/g, "");
}

export default function CategoryForm({ categoryId }: { categoryId?: string }) {
  const supabase = createSupabaseBrowser();
  const confirm = useConfirm();
  const router = useRouter();
  const [loading, setLoading] = useState(false);
  const [deleting, setDeleting] = useState(false);
  const [form, setForm] = useState<Partial<Category>>({
    name: "",
    slug: "",
    description: "",
    icon: "🌸",
    gradient_from: "#FFB3C6",
    gradient_to: "#FF8FA3",
    display_order: 0,
    is_active: true,
  });
  const [autoSlug, setAutoSlug] = useState(!categoryId);
  const [emojiQuery, setEmojiQuery] = useState("");

  useEffect(() => {
    if (!categoryId) return;
    supabase.from("categories").select("*").eq("id", categoryId).single().then(({ data }) => {
      if (data) setForm(data as Category);
    });
  }, [categoryId]);

  const filteredEmojis = useMemo(() => {
    const q = emojiQuery.trim();
    if (!q) return PRESET_EMOJIS;
    return PRESET_EMOJIS.filter((e) => e.includes(q));
  }, [emojiQuery]);

  function update<K extends keyof Category>(key: K, value: Category[K]) {
    setForm((prev) => ({ ...prev, [key]: value }));
  }

  function setName(v: string) {
    update("name", v);
    if (autoSlug) update("slug", slugify(v));
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!form.name?.trim() || !form.slug?.trim()) {
      toast.error("Nombre y slug son obligatorios");
      return;
    }

    setLoading(true);
    const payload = {
      name: form.name.trim(),
      slug: form.slug!.trim(),
      description: form.description || null,
      icon: form.icon || "🌸",
      gradient_from: form.gradient_from || "#FFB3C6",
      gradient_to: form.gradient_to || "#FF8FA3",
      display_order: form.display_order ?? 0,
      is_active: form.is_active ?? true,
    };

    const { error } = categoryId
      ? await supabase.from("categories").update(payload).eq("id", categoryId)
      : await supabase.from("categories").insert(payload);

    setLoading(false);

    if (error) {
      toast.error("Error: " + error.message);
      return;
    }
    toast.success(categoryId ? "Categoría actualizada" : "Categoría creada");
    router.push("/admin/categories");
    router.refresh();
  }

  async function handleDelete() {
    if (!categoryId) return;
    const ok = await confirm({
      title: "¿Eliminar esta categoría?",
      description: "Los productos asociados quedarán sin categoría. Esta acción no se puede deshacer.",
      confirmLabel: "Sí, eliminar",
      tone: "danger",
    });
    if (!ok) return;
    setDeleting(true);
    const { error } = await supabase.from("categories").delete().eq("id", categoryId);
    setDeleting(false);
    if (error) {
      toast.error("Error: " + error.message);
      return;
    }
    toast.success("Categoría eliminada");
    router.push("/admin/categories");
    router.refresh();
  }

  const previewGradient = `linear-gradient(135deg, ${form.gradient_from || "#FFB3C6"}, ${form.gradient_to || "#FF8FA3"})`;

  return (
    <form onSubmit={handleSubmit} className="max-w-5xl mx-auto">
      <Link
        href="/admin/categories"
        className="inline-flex items-center gap-2 text-ink-soft hover:text-rose-deep mb-4 text-sm"
      >
        <ArrowLeft className="w-4 h-4" /> Volver a categorías
      </Link>

      <div className="flex items-center justify-between mb-8 flex-wrap gap-3">
        <h1 className="font-display text-3xl md:text-4xl text-ink-primary">
          {categoryId ? "Editar categoría" : "Nueva categoría"}
        </h1>
        <div className="flex gap-2">
          {categoryId && (
            <button
              type="button"
              onClick={handleDelete}
              disabled={deleting}
              className="inline-flex items-center gap-2 px-4 py-2 rounded-full text-error hover:bg-error/10 font-semibold"
            >
              <Trash2 className="w-4 h-4" /> Eliminar
            </button>
          )}
          <button type="submit" disabled={loading} className="btn-primary">
            <Save className="w-4 h-4" /> {loading ? "Guardando..." : "Guardar"}
          </button>
        </div>
      </div>

      <div className="grid lg:grid-cols-3 gap-6">
        {/* PREVIEW */}
        <div className="lg:col-span-1">
          <div className="card sticky top-4">
            <p className="text-xs uppercase font-bold text-ink-soft tracking-wider mb-3">
              Vista previa
            </p>

            {/* Cómo se va a ver en mobile (pill) */}
            <div className="mb-4">
              <p className="text-[10px] uppercase font-bold text-ink-soft mb-2">App mobile</p>
              <div
                className="rounded-3xl px-5 py-4 inline-flex flex-col items-center min-w-[110px]"
                style={{ background: previewGradient }}
              >
                <span className="text-3xl mb-1">{form.icon || "🌸"}</span>
                <span className="text-white font-extrabold text-sm drop-shadow-sm">
                  {form.name || "Nombre"}
                </span>
              </div>
            </div>

            {/* Cómo se va a ver en web (card) */}
            <div>
              <p className="text-[10px] uppercase font-bold text-ink-soft mb-2">Web (home)</p>
              <div
                className="aspect-[4/5] rounded-3xl p-5 flex flex-col justify-between"
                style={{ background: previewGradient }}
              >
                <span className="text-4xl drop-shadow-sm">{form.icon || "🌸"}</span>
                <div>
                  <h3 className="font-display text-2xl text-white drop-shadow-sm">
                    {form.name || "Nombre"}
                  </h3>
                  <ArrowRight className="w-5 h-5 text-white mt-2" />
                </div>
              </div>
            </div>
          </div>
        </div>

        {/* FORM */}
        <div className="lg:col-span-2 space-y-6">
          {/* Datos básicos */}
          <div className="card">
            <h2 className="font-display text-xl text-ink-primary mb-4">Datos básicos</h2>
            <div className="space-y-4">
              <div>
                <label className="block text-sm font-semibold text-ink-secondary mb-1.5">
                  Nombre *
                </label>
                <input
                  className="input"
                  value={form.name || ""}
                  onChange={(e) => setName(e.target.value)}
                  placeholder="Ej: Lencería"
                  required
                />
              </div>

              <div>
                <label className="flex items-center justify-between text-sm font-semibold text-ink-secondary mb-1.5">
                  <span>Slug *</span>
                  <label className="flex items-center gap-1.5 text-xs font-normal text-ink-soft">
                    <input
                      type="checkbox"
                      checked={autoSlug}
                      onChange={(e) => setAutoSlug(e.target.checked)}
                    />
                    Auto desde nombre
                  </label>
                </label>
                <input
                  className="input font-mono text-sm"
                  value={form.slug || ""}
                  onChange={(e) => {
                    setAutoSlug(false);
                    update("slug", slugify(e.target.value));
                  }}
                  placeholder="lenceria"
                  required
                />
                <p className="text-xs text-ink-soft mt-1">
                  URL: /category/{form.slug || "..."}
                </p>
              </div>

              <div>
                <label className="block text-sm font-semibold text-ink-secondary mb-1.5">
                  Descripción
                </label>
                <textarea
                  className="input min-h-[80px]"
                  value={form.description || ""}
                  onChange={(e) => update("description", e.target.value)}
                  placeholder="Texto opcional que aparece en la página de la categoría"
                />
              </div>

              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="block text-sm font-semibold text-ink-secondary mb-1.5">
                    Orden
                  </label>
                  <input
                    type="number"
                    className="input"
                    value={form.display_order ?? 0}
                    onChange={(e) => update("display_order", Number(e.target.value))}
                  />
                </div>
                <div>
                  <label className="block text-sm font-semibold text-ink-secondary mb-1.5">
                    Estado
                  </label>
                  <button
                    type="button"
                    onClick={() => update("is_active", !form.is_active)}
                    className={`w-full px-4 py-3 rounded-2xl font-semibold transition ${
                      form.is_active
                        ? "bg-success/30 text-ink-primary"
                        : "bg-ink-soft/15 text-ink-soft"
                    }`}
                  >
                    {form.is_active ? "✓ Activa" : "Inactiva"}
                  </button>
                </div>
              </div>
            </div>
          </div>

          {/* ICONO */}
          <div className="card">
            <h2 className="font-display text-xl text-ink-primary mb-1">Icono</h2>
            <p className="text-sm text-ink-soft mb-4">Elegí un emoji o pegá uno custom abajo.</p>

            <div className="flex items-center gap-3 mb-4">
              <div className="w-20 h-20 rounded-2xl flex items-center justify-center text-5xl bg-rose-whisper">
                {form.icon || "🌸"}
              </div>
              <input
                className="input flex-1"
                value={form.icon || ""}
                onChange={(e) => update("icon", e.target.value)}
                placeholder="Emoji custom (ej: 🦋)"
                maxLength={4}
              />
            </div>

            <input
              type="text"
              placeholder="Buscar emoji..."
              value={emojiQuery}
              onChange={(e) => setEmojiQuery(e.target.value)}
              className="input mb-3"
            />

            <div className="grid grid-cols-10 gap-2 max-h-[260px] overflow-y-auto p-2 bg-rose-whisper rounded-2xl">
              {filteredEmojis.map((emoji) => (
                <button
                  type="button"
                  key={emoji}
                  onClick={() => update("icon", emoji)}
                  className={`aspect-square rounded-xl text-2xl transition ${
                    form.icon === emoji
                      ? "bg-rose-deep text-white scale-110 shadow-lift"
                      : "bg-white hover:bg-rose-pastel"
                  }`}
                >
                  {emoji}
                </button>
              ))}
            </div>
          </div>

          {/* GRADIENTE */}
          <div className="card">
            <h2 className="font-display text-xl text-ink-primary mb-1">Gradiente de fondo</h2>
            <p className="text-sm text-ink-soft mb-4">
              Tocá un preset o ajustá los hex manualmente.
            </p>

            <div className="grid grid-cols-3 sm:grid-cols-4 gap-2 mb-5">
              {PRESET_GRADIENTS.map((g) => {
                const isSelected =
                  form.gradient_from === g.from && form.gradient_to === g.to;
                return (
                  <button
                    type="button"
                    key={g.name}
                    onClick={() => {
                      update("gradient_from", g.from);
                      update("gradient_to", g.to);
                    }}
                    className={`aspect-[3/2] rounded-2xl flex items-end p-2 transition ${
                      isSelected ? "ring-4 ring-rose-deep scale-105" : "hover:scale-105"
                    }`}
                    style={{
                      background: `linear-gradient(135deg, ${g.from}, ${g.to})`,
                    }}
                  >
                    <span className="text-[10px] text-white drop-shadow font-bold uppercase">
                      {g.name}
                    </span>
                  </button>
                );
              })}
            </div>

            <div className="grid grid-cols-2 gap-4">
              <div>
                <label className="block text-sm font-semibold text-ink-secondary mb-1.5">
                  Color desde
                </label>
                <div className="flex gap-2 items-center">
                  <input
                    type="color"
                    value={form.gradient_from || "#FFB3C6"}
                    onChange={(e) => update("gradient_from", e.target.value)}
                    className="w-12 h-12 rounded-xl border border-rose-medium/40 cursor-pointer"
                  />
                  <input
                    className="input font-mono text-sm uppercase"
                    value={form.gradient_from || ""}
                    onChange={(e) => update("gradient_from", e.target.value)}
                    placeholder="#FFB3C6"
                    maxLength={7}
                  />
                </div>
              </div>
              <div>
                <label className="block text-sm font-semibold text-ink-secondary mb-1.5">
                  Color hasta
                </label>
                <div className="flex gap-2 items-center">
                  <input
                    type="color"
                    value={form.gradient_to || "#FF8FA3"}
                    onChange={(e) => update("gradient_to", e.target.value)}
                    className="w-12 h-12 rounded-xl border border-rose-medium/40 cursor-pointer"
                  />
                  <input
                    className="input font-mono text-sm uppercase"
                    value={form.gradient_to || ""}
                    onChange={(e) => update("gradient_to", e.target.value)}
                    placeholder="#FF8FA3"
                    maxLength={7}
                  />
                </div>
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* Submit footer (mobile-friendly) */}
      <div className="sticky bottom-4 mt-6 flex justify-end">
        <button type="submit" disabled={loading} className="btn-primary shadow-lift">
          <Save className="w-4 h-4" /> {loading ? "Guardando..." : "Guardar"}
        </button>
      </div>
    </form>
  );
}
