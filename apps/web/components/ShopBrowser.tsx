"use client";

// Browser de la tienda: hero de destacados + buscador + chips de categorías + grilla.
// Filtros 100% client-side (los productos vienen pre-cargados del server).
// El estado se sincroniza con la URL (?q=&cat=&sort=) para que se pueda compartir/recargar.

import { useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { usePathname, useRouter, useSearchParams } from "next/navigation";
import { ArrowRight, ChevronDown, Search, Sparkles, X } from "lucide-react";
import ProductCardGlam from "@/components/ProductCardGlam";
import MiniCrab3D from "@/components/MiniCrab3D";
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
  const pathname = usePathname();
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
    router.replace(qs ? `${pathname}?${qs}` : pathname, { scroll: false });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [debouncedQ, cat, sort]);

  const filtered = useMemo(() => {
    let list = products;
    if (cat)
      list = list.filter((p) => {
        if (p.category?.slug === cat) return true;
        const links = (p as any).product_categories as
          | Array<{ category?: { slug?: string } | null }>
          | undefined;
        return (
          (links ?? []).some((l) => l.category?.slug === cat) ||
          (p as any).category_id === cat
        );
      });
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
    <main className="relative overflow-hidden bg-[#0B0509]">
      {/* Video de fondo fijo (el mismo del inicio) + velo oscuro */}
      <div aria-hidden className="fixed inset-0 pointer-events-none">
        <video
          autoPlay
          loop
          muted
          playsInline
          preload="none"
          className="w-full h-full object-cover opacity-60"
          src="https://pub-4ee8d6afe02b441fa29b28b501f5a6be.r2.dev/fondocance1.mp4"
        />
        <div className="absolute inset-0 bg-gradient-to-b from-[#0B0509]/80 via-[#0B0509]/60 to-[#0B0509]/85" />
      </div>

      {/* Decoración de fondo (mismo glam oscuro que la home) */}
      <div aria-hidden className="absolute inset-0 pointer-events-none">
        <div className="absolute -top-48 -left-48 w-[38rem] h-[38rem] bg-rose-deep/25 rounded-full blur-[140px]" />
        <div className="absolute top-[28%] -right-56 w-[34rem] h-[34rem] bg-[#FF4081]/15 rounded-full blur-[150px]" />
        <div className="absolute top-[60%] -left-40 w-[30rem] h-[30rem] bg-rose-primary/10 rounded-full blur-[130px]" />
        <div className="absolute bottom-0 right-[15%] w-[26rem] h-[26rem] bg-rose-deep/15 rounded-full blur-[120px]" />
        <Sparkles className="absolute top-[10%] left-[6%] w-4 h-4 text-rose-primary/70 sparkle-twinkle" />
        <Sparkles className="absolute top-[34%] right-[8%] w-3 h-3 text-white/50 sparkle-twinkle" style={{ animationDelay: "0.8s" }} />
        <Sparkles className="absolute top-[58%] left-[10%] w-3.5 h-3.5 text-rose-medium/60 sparkle-twinkle" style={{ animationDelay: "1.4s" }} />
        <Sparkles className="absolute top-[80%] right-[14%] w-4 h-4 text-rose-primary/50 sparkle-twinkle" style={{ animationDelay: "2s" }} />
      </div>

      {/* HERO destacados */}
      {featured.length > 0 && (
        <section className="relative max-w-6xl mx-auto px-4 pt-8 md:pt-10 pb-2">
          <div className="flex items-end justify-between mb-5">
            <div>
              <span className="inline-flex items-center gap-2 bg-white/10 border border-white/15 backdrop-blur text-rose-primary px-3 py-1 rounded-full text-xs font-bold uppercase tracking-wider">
                <Sparkles className="w-3.5 h-3.5" /> Destacados
              </span>
              <h1 className="font-display text-3xl md:text-5xl text-white font-black mt-3 leading-tight">
                Lo más amado{" "}
                <span className="italic bg-gradient-to-r from-rose-primary via-rose-medium to-rose-deep bg-clip-text text-transparent">
                  de la tienda
                </span>
              </h1>
            </div>
          </div>
          <div className="grid grid-cols-2 md:grid-cols-4 gap-3 md:gap-5">
            {featured.slice(0, 8).map((p) => (
              <ProductCardGlam key={p.id} product={p} glow />
            ))}
          </div>
        </section>
      )}

      {/* Buscador + categorías + sort + grilla */}
      <section
        id="catalogo"
        className="relative max-w-6xl mx-auto px-4 py-8 md:py-12"
      >
        {/* Headline section */}
        <div className="mb-6">
          <div className="flex items-end justify-between flex-wrap gap-3">
            <div>
              <h2 className="font-display text-3xl md:text-5xl text-white font-black leading-tight flex items-center gap-1 flex-wrap">
                <span>
                  Mirá toda la tienda{" "}
                  <span className="italic bg-gradient-to-r from-rose-primary via-rose-medium to-rose-deep bg-clip-text text-transparent">
                    de Cancerianas
                  </span>
                </span>
                <MiniCrab3D />
              </h2>
            </div>
            <div className="flex items-center gap-2">
              <span className="text-sm text-white/50 tabular-nums">
                <strong className="text-white text-base">{filtered.length}</strong>{" "}
                {filtered.length === 1 ? "producto" : "productos"}
              </span>
              {(debouncedQ || cat) && (
                <button
                  type="button"
                  onClick={() => {
                    setQ("");
                    setCat("");
                  }}
                  className="inline-flex items-center gap-1 bg-white/10 border border-white/15 text-rose-primary font-semibold text-xs px-3 py-1.5 rounded-full hover:bg-white/20 transition-colors"
                >
                  <X className="w-3 h-3" /> Limpiar
                </button>
              )}
            </div>
          </div>
        </div>

        {/* Toolbar sticky con glass effect */}
        <div className="sticky top-[62px] sm:top-[72px] z-20 -mx-4 px-4 py-3 mb-5 bg-[#0B0509]/85 backdrop-blur-md border-y border-white/10">
          <div className="flex items-center gap-3 flex-wrap">
            <div className="relative flex-1 min-w-[220px] group">
              <Search className="absolute left-4 top-1/2 -translate-y-1/2 w-4 h-4 text-white/40 pointer-events-none group-focus-within:text-rose-primary transition-colors" />
              <input
                type="search"
                value={q}
                onChange={(e) => setQ(e.target.value)}
                placeholder="Buscá un producto, marca o categoría…"
                autoComplete="off"
                className="w-full pl-11 pr-10 py-3 rounded-full bg-white/[0.07] border border-white/15 text-sm text-white placeholder:text-white/40 focus:outline-none focus:ring-4 focus:ring-rose-primary/25 focus:border-rose-primary/60 focus:bg-white/10 transition-all"
              />
              {q && (
                <button
                  type="button"
                  onClick={() => setQ("")}
                  className="absolute right-3 top-1/2 -translate-y-1/2 p-1 rounded-full text-white/50 hover:text-rose-primary hover:bg-white/10 transition"
                  aria-label="Limpiar"
                >
                  <X className="w-4 h-4" />
                </button>
              )}
            </div>
            <div className="relative">
              <select
                value={sort}
                onChange={(e) => setSort(e.target.value as SortKey)}
                style={{ colorScheme: "dark" }}
                className="appearance-none cursor-pointer pl-4 pr-9 py-3 rounded-full bg-white/[0.07] border border-white/15 text-sm font-semibold text-white focus:outline-none focus:ring-4 focus:ring-rose-primary/25 focus:border-rose-primary/60 transition-all hover:bg-white/10"
              >
                {(Object.keys(SORT_LABELS) as SortKey[]).map((k) => (
                  <option key={k} value={k}>
                    {SORT_LABELS[k]}
                  </option>
                ))}
              </select>
              <ChevronDown className="absolute right-3 top-1/2 -translate-y-1/2 w-4 h-4 text-white/40 pointer-events-none" />
            </div>
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
          <div className="rounded-3xl bg-white/[0.05] backdrop-blur border border-white/10 text-center py-20">
            <div className="text-6xl mb-3">🌸</div>
            <p className="text-white/70">
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
                className="btn-primary mt-5 !py-2.5 !text-sm"
              >
                Ver todos los productos
              </button>
            )}
          </div>
        ) : (
          <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-3 md:gap-5">
            {filtered.map((p) => (
              <ProductCardGlam key={p.id} product={p} glow />
            ))}
          </div>
        )}
      </section>

      {/* Categorías como cards al final, para SEO + descubrimiento */}
      {categories.length > 0 && (
        <section className="relative max-w-6xl mx-auto px-4 pb-16">
          <h2 className="font-display text-2xl md:text-3xl font-black text-white mb-6">
            Explorá por{" "}
            <span className="italic bg-gradient-to-r from-rose-primary to-rose-deep bg-clip-text text-transparent">
              categoría
            </span>
          </h2>
          <div className="grid grid-cols-2 md:grid-cols-4 gap-3 md:gap-5">
            {categories.map((c) => {
              const from = (c as any).gradient_from || "#FFE5EC";
              const to = (c as any).gradient_to || "#FFB3C6";
              return (
                <Link
                  key={c.id}
                  href={`/category/${c.slug}`}
                  aria-label={c.name}
                  className="category-glow relative aspect-square rounded-3xl shadow-soft hover:shadow-lift transition-all hover:-translate-y-1 group"
                  style={
                    c.image_url
                      ? {
                          backgroundImage: `url(${c.image_url})`,
                          backgroundSize: "cover",
                          backgroundPosition: "center",
                        }
                      : {
                          background: `radial-gradient(circle at 25% 20%, ${from}, ${to} 75%)`,
                        }
                  }
                >
                  {!c.image_url && (
                    <div className="absolute top-3 left-3 md:top-4 md:left-4 w-10 h-10 md:w-12 md:h-12 rounded-full bg-white/95 backdrop-blur flex items-center justify-center shadow-md ring-1 ring-black/5 group-hover:scale-110 transition-transform">
                      <span className="text-xl md:text-2xl leading-none">{c.icon || "🌸"}</span>
                    </div>
                  )}
                  <h3 className="absolute bottom-3 left-3 md:bottom-4 md:left-4 font-sans text-sm md:text-base font-bold text-white tracking-tight leading-none drop-shadow-[0_2px_4px_rgba(0,0,0,0.5)]">
                    {c.name}
                  </h3>
                  <ArrowRight className="absolute bottom-4 right-4 w-5 h-5 text-white drop-shadow opacity-0 group-hover:opacity-100 group-hover:translate-x-0 -translate-x-2 transition-all" />
                </Link>
              );
            })}
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
      className={`inline-flex items-center gap-1.5 px-4 py-2 rounded-full whitespace-nowrap text-sm font-semibold transition-all duration-200 flex-shrink-0 border ${
        active
          ? "bg-gradient-to-r from-rose-deep to-rose-primary text-white shadow-[0_4px_16px_-2px_rgba(230,107,133,0.5)] border-transparent scale-[1.03]"
          : "bg-white/[0.07] text-white/85 border-white/15 hover:bg-white/15 hover:border-rose-primary/50 hover:scale-[1.02]"
      }`}
    >
      <span className="text-base leading-none">{icon}</span>
      {label}
    </button>
  );
}
