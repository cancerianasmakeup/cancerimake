"use client";

import { useMemo, useState } from "react";
import Link from "next/link";
import {
  Plus,
  Search,
  Eye,
  Pencil,
  PackageX,
  Package,
  AlertTriangle,
  X,
} from "lucide-react";
import { formatPrice } from "@cancerianas/shared";

// Normaliza texto para búsqueda (minúsculas, sin tildes)
function normalize(s: string): string {
  return (s || "")
    .toLowerCase()
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "");
}

interface CategoryLite {
  id: string;
  name: string;
}

interface AdminProduct {
  id: string;
  name: string;
  slug: string;
  price: number;
  compare_price: number | null;
  stock: number;
  sku: string | null;
  images: string[] | null;
  status: "active" | "draft" | "archived";
  weight_grams: number | null;
  product_categories?: Array<{
    category_id: string;
    is_primary: boolean;
    category: { id: string; name: string } | null;
  }>;
}

const STATUS_LABELS: Record<string, string> = {
  active: "Activo",
  draft: "Borrador",
  archived: "Archivado",
};

export default function AdminProductsBrowser({
  products,
  categories,
}: {
  products: AdminProduct[];
  categories: CategoryLite[];
}) {
  const [query, setQuery] = useState("");
  const [categoryId, setCategoryId] = useState<string>("all");
  const [status, setStatus] = useState<string>("all");

  const stats = useMemo(() => {
    const active = products.filter((p) => p.status === "active").length;
    const draft = products.filter((p) => p.status === "draft").length;
    const lowStock = products.filter((p) => p.status !== "archived" && p.stock <= 3).length;
    return { total: products.length, active, draft, lowStock };
  }, [products]);

  const filtered = useMemo(() => {
    const q = normalize(query.trim());
    return products.filter((p) => {
      if (status !== "all" && p.status !== status) return false;
      if (status === "all" && p.status === "archived") return false;
      if (categoryId !== "all") {
        const ids = (p.product_categories ?? []).map((l) => l.category_id);
        if (!ids.includes(categoryId)) return false;
      }
      if (q) {
        const hay = normalize(`${p.name} ${p.slug} ${p.sku ?? ""}`);
        if (!hay.includes(q)) return false;
      }
      return true;
    });
  }, [products, query, categoryId, status]);

  const archivedCount = useMemo(
    () => products.filter((p) => p.status === "archived").length,
    [products]
  );

  return (
    <div className="max-w-7xl">
      {/* Header */}
      <div className="flex items-center justify-between flex-wrap gap-4 mb-6">
        <div>
          <h1 className="font-display text-3xl md:text-4xl text-ink-primary">Productos</h1>
          <p className="text-ink-secondary mt-1">
            {stats.total} en total · {stats.active} activos
            {stats.lowStock > 0 && (
              <span className="text-error font-semibold"> · {stats.lowStock} con stock bajo</span>
            )}
          </p>
        </div>
        <Link href="/admin/products/new" className="btn-primary">
          <Plus className="w-4 h-4" /> Nuevo
        </Link>
      </div>

      {/* Toolbar: búsqueda + filtros */}
      <div className="bg-white rounded-3xl shadow-soft border border-rose-pastel p-4 mb-6 space-y-3">
        <div className="flex flex-wrap items-center gap-3">
          {/* Buscador */}
          <div className="relative flex-1 min-w-[220px]">
            <Search className="absolute left-3.5 top-1/2 -translate-y-1/2 w-4 h-4 text-ink-soft pointer-events-none" />
            <input
              type="text"
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              placeholder="Buscar por nombre, SKU o slug…"
              className="w-full pl-10 pr-9 py-2.5 bg-rose-whisper/60 border border-rose-medium/30 rounded-2xl text-sm text-ink-primary placeholder:text-ink-soft focus:outline-none focus:border-rose-primary focus:ring-2 focus:ring-rose-pastel focus:bg-white transition"
            />
            {query && (
              <button
                onClick={() => setQuery("")}
                className="absolute right-2.5 top-1/2 -translate-y-1/2 p-1 text-ink-soft hover:text-error transition"
                title="Limpiar búsqueda"
              >
                <X className="w-3.5 h-3.5" />
              </button>
            )}
          </div>

          {/* Filtro por estado */}
          <div className="flex items-center gap-1.5">
            {["all", "active", "draft", "archived"].map((s) => (
              <button
                key={s}
                onClick={() => setStatus(s)}
                className={`px-3 py-1.5 rounded-full text-xs font-bold transition ${
                  status === s
                    ? "bg-ink-primary text-white shadow-sm"
                    : "bg-rose-whisper text-ink-secondary hover:bg-rose-pastel"
                }`}
              >
                {s === "all" ? "Todos" : STATUS_LABELS[s]}
                {s === "archived" && archivedCount > 0 && ` (${archivedCount})`}
              </button>
            ))}
          </div>
        </div>

        {/* Pills de categorías */}
        <div className="flex items-center gap-1.5 overflow-x-auto scrollbar-hide -mx-1 px-1 pb-0.5">
          <button
            onClick={() => setCategoryId("all")}
            className={`flex-shrink-0 px-3.5 py-1.5 rounded-full text-xs font-bold transition ${
              categoryId === "all"
                ? "bg-gradient-to-r from-rose-primary to-rose-deep text-white shadow-sm"
                : "bg-rose-whisper text-ink-secondary hover:bg-rose-pastel"
            }`}
          >
            Todas las categorías
          </button>
          {categories.map((c) => (
            <button
              key={c.id}
              onClick={() => setCategoryId(categoryId === c.id ? "all" : c.id)}
              className={`flex-shrink-0 px-3.5 py-1.5 rounded-full text-xs font-bold transition ${
                categoryId === c.id
                  ? "bg-gradient-to-r from-rose-primary to-rose-deep text-white shadow-sm"
                  : "bg-rose-whisper text-ink-secondary hover:bg-rose-pastel"
              }`}
            >
              {c.name}
            </button>
          ))}
        </div>
      </div>

      {/* Resultado del filtro */}
      {(query || categoryId !== "all" || status !== "all") && (
        <p className="text-sm text-ink-soft mb-4">
          {filtered.length} resultado{filtered.length !== 1 ? "s" : ""}
        </p>
      )}

      {/* Grid de cards */}
      {filtered.length > 0 ? (
        <div className="grid grid-cols-2 md:grid-cols-3 xl:grid-cols-4 gap-4">
          {filtered.map((p) => {
            const links = p.product_categories ?? [];
            const primaryCat =
              links.find((l) => l.is_primary)?.category?.name ?? links[0]?.category?.name;
            const extraCats = links.length - 1;
            const outOfStock = p.stock <= 0;
            const lowStock = !outOfStock && p.stock <= 3;

            return (
              <div
                key={p.id}
                className="group relative bg-white rounded-3xl shadow-soft border border-rose-pastel overflow-hidden hover:shadow-lift hover:-translate-y-0.5 transition-all"
              >
                {/* Imagen (toda la card linkea a editar) */}
                <Link href={`/admin/products/${p.id}`} className="block">
                  <div className="relative aspect-square bg-rose-whisper overflow-hidden">
                    {p.images?.[0] ? (
                      // eslint-disable-next-line @next/next/no-img-element
                      <img
                        src={p.images[0]}
                        alt={p.name}
                        loading="lazy"
                        className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-300"
                      />
                    ) : (
                      <div className="w-full h-full flex items-center justify-center text-5xl">
                        🌸
                      </div>
                    )}

                    {/* Badge estado (solo si no está activo) */}
                    {p.status !== "active" && (
                      <span
                        className={`absolute top-2.5 left-2.5 text-[10px] font-bold uppercase tracking-wide px-2 py-1 rounded-full backdrop-blur ${
                          p.status === "draft"
                            ? "bg-warning/90 text-ink-primary"
                            : "bg-ink-primary/80 text-white"
                        }`}
                      >
                        {STATUS_LABELS[p.status]}
                      </span>
                    )}

                    {/* Badge stock */}
                    <span
                      className={`absolute top-2.5 right-2.5 inline-flex items-center gap-1 text-[10px] font-bold px-2 py-1 rounded-full backdrop-blur ${
                        outOfStock
                          ? "bg-error/90 text-white"
                          : lowStock
                          ? "bg-warning/90 text-ink-primary"
                          : "bg-white/85 text-ink-secondary"
                      }`}
                    >
                      {outOfStock ? <PackageX size={10} /> : <Package size={10} />}
                      {outOfStock ? "Sin stock" : `${p.stock} u.`}
                    </span>

                    {/* Sin peso */}
                    {!p.weight_grams && (
                      <span
                        className="absolute bottom-2.5 left-2.5 inline-flex items-center gap-1 bg-error/90 text-white text-[10px] font-bold px-2 py-1 rounded-full backdrop-blur"
                        title="Falta cargar el peso para los envíos"
                      >
                        <AlertTriangle size={10} /> sin peso
                      </span>
                    )}
                  </div>

                  {/* Info */}
                  <div className="p-3.5">
                    {primaryCat && (
                      <p className="text-[10px] font-bold uppercase tracking-wider text-rose-deep mb-1 truncate">
                        {primaryCat}
                        {extraCats > 0 && (
                          <span className="text-ink-soft normal-case"> +{extraCats}</span>
                        )}
                      </p>
                    )}
                    <h3 className="text-sm font-semibold text-ink-primary leading-snug line-clamp-2 min-h-[2.5em]">
                      {p.name}
                    </h3>
                    <div className="flex items-baseline gap-1.5 mt-1.5">
                      <span className="font-display text-lg font-bold text-ink-primary">
                        {formatPrice(p.price)}
                      </span>
                      {p.compare_price && p.compare_price > p.price && (
                        <span className="text-xs text-ink-soft line-through">
                          {formatPrice(p.compare_price)}
                        </span>
                      )}
                    </div>
                  </div>
                </Link>

                {/* Acciones */}
                <div className="flex items-center gap-2 px-3.5 pb-3.5">
                  <Link
                    href={`/admin/products/${p.id}`}
                    className="flex-1 inline-flex items-center justify-center gap-1.5 bg-rose-whisper hover:bg-rose-pastel text-ink-primary text-xs font-bold py-2 rounded-xl transition"
                  >
                    <Pencil size={12} /> Editar
                  </Link>
                  <Link
                    href={`/product/${p.slug}`}
                    target="_blank"
                    className="inline-flex items-center justify-center p-2 bg-rose-whisper hover:bg-rose-pastel text-ink-secondary rounded-xl transition"
                    title="Ver en la tienda"
                  >
                    <Eye size={14} />
                  </Link>
                </div>
              </div>
            );
          })}
        </div>
      ) : (
        <div className="text-center py-20 bg-white rounded-3xl shadow-soft border border-rose-pastel">
          <div className="text-5xl mb-3">🔍</div>
          {products.length === 0 ? (
            <>
              <p className="text-ink-primary font-semibold mb-1">Todavía no hay productos</p>
              <Link href="/admin/products/new" className="text-rose-deep font-semibold text-sm">
                Creá el primero →
              </Link>
            </>
          ) : (
            <>
              <p className="text-ink-primary font-semibold mb-1">
                Nada por acá con esos filtros
              </p>
              <button
                onClick={() => {
                  setQuery("");
                  setCategoryId("all");
                  setStatus("all");
                }}
                className="text-rose-deep font-semibold text-sm"
              >
                Limpiar filtros
              </button>
            </>
          )}
        </div>
      )}
    </div>
  );
}
