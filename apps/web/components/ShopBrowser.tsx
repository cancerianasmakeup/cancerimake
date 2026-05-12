"use client";

// Browser de la tienda: hero de destacados + buscador + chips de categorías + grilla.
// Filtros 100% client-side (los productos vienen pre-cargados del server).
// El estado se sincroniza con la URL (?q=&cat=&sort=) para que se pueda compartir/recargar.

import { useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { useRouter, useSearchParams } from "next/navigation";
import { ArrowRight, Search, Sparkles, X } from "lucide-react";
import ProductCard from "@/components/ProductCard";
import type { Product, Category } from "@cancerianas/shared";

type SortKey = "recent" | "price_asc" | "price_desc" | "name_asc";

const SORT_LABELS: Record<SortKey, string> = {
  recent: "Más recientes",
  price_asc: "Precio · menor a mayor",
  price_desc: "Precio · mayor a menor",
  name_asc: "Alfabético",
};

export default function ShopBrowser({
  featured,
  categories,
  products,
  initialQ,
  initialCat,
  initialSort,
}: {
  featured: Product[];
  categories: Category[];
  products: (Product & { category?: { name: string; slug: string } | null })[];
  initialQ: string;
  initialCat: string;
  initialSort: string;
}) {
  const router = useRouter();
  const searchParams = useSearchParams();
  const [q, setQ] = useState(initialQ);
  const [debouncedQ, setDebouncedQ] = useState(initialQ);
  const [cat, setCat] = useState(initialCat);
  const [sort, setSort] = useState<SortKey>(
    (Object.keys(SORT_LABELS).includes(initialSort) ? initialSort : "recent") as SortKey
  );

  // Debounce del search
  useEffect(() => {
    const t = setTimeout(() => setDebouncedQ(q.trim()), 250);
    return () => clearTimeout(t);
  }, [q]);

  // Sync URL → no recarga, sólo replace
  useEffect(() => {
    const next = new URLSearchParams(searchParams.toString());
    if (debouncedQ) next.set("q", debouncedQ);
    else next.delete("q");
    if (cat) next.set("cat", cat);
    else next.delete("cat");
    if (sort && sort !== "recent") next.set("sort", sort);
    else next.delete("sort");
    const qs = next.toString();
    router.replace(qs ? `/shop?${qs}` : "/shop", { scroll: false });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [debouncedQ, cat, sort]);

  const filtered = useMemo(() => {
    let list = products;
    if (cat) list = list.filter((p) => p.category?.slug === cat || (p as any).category_id === cat);
    if (debouncedQ) {
      const needle = debouncedQ.toLowerCase();
      list = list.filter((p) =>
        (p.name + " " + (p.description ?? "")).toLowerCase().includes(needle)
      );
    }
    const sorted = [...list];
    if (sort === "recent")
      sorted.sort((a, b) => +new Date(b.created_at) - +new Date(a.created_at));
    else if (sort === "price_asc") sorted.sort((a, b) => Number(a.price) - Number(b.price));
    else if (sort === "price_desc") sorted.sort((a, b) => Number(b.price) - Number(a.price));
    else if (sort === "name_asc") sorted.sort((a, b) => a.name.localeCompare(b.name, "es"));
    return sorted;
  }, [products, debouncedQ, cat, sort]);

  return (
    <main>
      {/* HERO destacados */}
      {featured.length > 0 && (
        <section className="max-w-6xl mx-auto px-4 pt-8 md:pt-10 pb-2">
          <div className="flex items-end justify-between mb-5">
            <div>
              <span className="inline-flex items-center gap-2 bg-rose-pastel text-rose-deep px-3 py-1 rounded-full text-xs font-bold uppercase tracking-wider">
                <Sparkles className="w-3.5 h-3.5" /> Destacados
              </span>
              <h1 className="font-display text-3xl md:text-5xl text-ink-primary mt-3 leading-tight">
                Lo más amado <span className="italic text-rose-deep">de la tienda</span>
              </h1>
            </div>
          </div>
          <div className="grid grid-cols-2 md:grid-cols-4 gap-3 md:gap-5">
            {featured.slice(0, 8).map((p) => (
              <ProductCard key={p.id} product={p} />
            ))}
          </div>
        </section>
      )}

      {/* Buscador + categorías + sort + grilla */}
      <section
        id="catalogo"
        className="max-w-6xl mx-auto px-4 py-8 md:py-12"
      >
        <div className="flex items-end justify-between mb-4 flex-wrap gap-3">
          <h2 className="font-display text-2xl md:text-3xl text-ink-primary">
            Catálogo completo
          </h2>
          <div className="text-sm text-ink-soft">
            {filtered.length}{" "}
            {filtered.length === 1 ? "producto" : "productos"}
            {(debouncedQ || cat) && (
              <button
                type="button"
                onClick={() => {
                  setQ("");
                  setCat("");
                }}
                className="ml-2 text-rose-deep font-semibold hover:underline"
              >
                limpiar filtros
              </button>
            )}
          </div>
        </div>

        {/* Search bar */}
        <div className="sticky top-[62px] sm:top-[72px] z-20 bg-cream/90 backdrop-blur py-2 -mx-4 px-4 mb-3">
          <div className="flex items-center gap-2 flex-wrap">
            <div className="relative flex-1 min-w-[200px]">
              <Search className="absolute left-4 top-1/2 -translate-y-1/2 w-4 h-4 text-ink-soft pointer-events-none" />
              <input
                type="search"
                value={q}
                onChange={(e) => setQ(e.target.value)}
                placeholder="Buscá un producto…"
                autoComplete="off"
                className="input pl-11 pr-10"
              />
              {q && (
                <button
                  type="button"
                  onClick={() => setQ("")}
                  className="absolute right-3 top-1/2 -translate-y-1/2 text-ink-soft hover:text-rose-deep"
                  aria-label="Limpiar"
                >
                  <X className="w-4 h-4" />
                </button>
              )}
            </div>
            <select
              value={sort}
              onChange={(e) => setSort(e.target.value as SortKey)}
              className="input w-auto text-sm"
            >
              {(Object.keys(SORT_LABELS) as SortKey[]).map((k) => (
                <option key={k} value={k}>
                  {SORT_LABELS[k]}
                </option>
              ))}
            </select>
          </div>

          {/* Chips categorías */}
          <div className="flex gap-2 mt-3 overflow-x-auto pb-1 -mx-1 px-1 scrollbar-hide">
            <CategoryChip
              label="Todo"
              icon="✨"
              active={!cat}
              onClick={() => setCat("")}
            />
            {categories.map((c) => (
              <CategoryChip
                key={c.id}
                label={c.name}
                icon={c.icon || "🌸"}
                active={cat === c.slug || cat === c.id}
                onClick={() => setCat(c.slug)}
              />
            ))}
          </div>
        </div>

        {/* Grid */}
        {filtered.length === 0 ? (
          <div className="card text-center py-20">
            <div className="text-6xl mb-3">🌸</div>
            <p className="text-ink-secondary">
              {debouncedQ
                ? `No encontramos productos para "${debouncedQ}"`
                : "Todavía no hay productos en esta categoría"}
            </p>
            {(debouncedQ || cat) && (
              <button
                type="button"
                onClick={() => {
                  setQ("");
                  setCat("");
                }}
                className="btn-secondary mt-4 text-sm"
              >
                Ver todos los productos
              </button>
            )}
          </div>
        ) : (
          <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-3 md:gap-5">
            {filtered.map((p) => (
              <ProductCard key={p.id} product={p} />
            ))}
          </div>
        )}
      </section>

      {/* Categorías como cards al final, para SEO + descubrimiento */}
      {categories.length > 0 && (
        <section className="max-w-6xl mx-auto px-4 pb-16">
          <h2 className="font-display text-2xl md:text-3xl text-ink-primary mb-6">
            Explorá por categoría
          </h2>
          <div className="grid grid-cols-2 md:grid-cols-5 gap-3 md:gap-4">
            {categories.map((c) => (
              <Link
                key={c.id}
                href={`/category/${c.slug}`}
                className="aspect-[4/5] rounded-3xl p-4 flex flex-col justify-between hover:shadow-lift transition-all hover:-translate-y-1"
                style={{
                  background: `linear-gradient(135deg, ${(c as any).gradient_from || "#FFE5EC"}, ${(c as any).gradient_to || "#FFB3C6"})`,
                }}
              >
                <span className="text-3xl drop-shadow-sm">{c.icon || "🌸"}</span>
                <div>
                  <h3 className="font-display text-xl text-white drop-shadow-sm">
                    {c.name}
                  </h3>
                  <ArrowRight className="w-4 h-4 text-white mt-1" />
                </div>
              </Link>
            ))}
          </div>
        </section>
      )}
    </main>
  );
}

function CategoryChip({
  label,
  icon,
  active,
  onClick,
}: {
  label: string;
  icon: string;
  active: boolean;
  onClick: () => void;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      className={`inline-flex items-center gap-1.5 px-4 py-2 rounded-full whitespace-nowrap text-sm font-semibold transition flex-shrink-0 ${
        active
          ? "bg-rose-deep text-white shadow-soft"
          : "bg-white text-ink-primary hover:bg-rose-pastel/60"
      }`}
    >
      <span className="text-base leading-none">{icon}</span>
      {label}
    </button>
  );
}
