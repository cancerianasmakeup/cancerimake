import Link from "next/link";
import { Plus, Edit, ArrowRight } from "lucide-react";
import { createSupabaseServer } from "@/lib/supabase-server";
import type { Category } from "@cancerianas/shared";

export const dynamic = "force-dynamic";

export default async function AdminCategoriesPage() {
  const supabase = await createSupabaseServer();
  const { data: categories } = await supabase
    .from("categories")
    .select("*")
    .order("display_order");

  // Contar productos por categoría (una query separada)
  const { data: productCounts } = await supabase
    .from("products")
    .select("category_id");
  const counts: Record<string, number> = {};
  productCounts?.forEach((p: any) => {
    if (p.category_id) counts[p.category_id] = (counts[p.category_id] ?? 0) + 1;
  });

  const list = (categories as Category[]) ?? [];

  return (
    <div className="max-w-6xl">
      <div className="flex items-center justify-between mb-8 flex-wrap gap-3">
        <div>
          <h1 className="font-display text-3xl md:text-4xl text-ink-primary">Categorías</h1>
          <p className="text-ink-secondary mt-1">{list.length} categorías</p>
        </div>
        <Link href="/admin/categories/new" className="btn-primary">
          <Plus className="w-4 h-4" /> Nueva
        </Link>
      </div>

      {list.length === 0 ? (
        <div className="card text-center py-16">
          <div className="text-5xl mb-3">🌷</div>
          <p className="text-ink-soft mb-4">Todavía no hay categorías.</p>
          <Link href="/admin/categories/new" className="btn-primary inline-flex">
            <Plus className="w-4 h-4" /> Crear la primera
          </Link>
        </div>
      ) : (
        <div className="grid sm:grid-cols-2 lg:grid-cols-3 gap-4">
          {list.map((c) => (
            <Link
              key={c.id}
              href={`/admin/categories/${c.id}`}
              className="card group hover:shadow-lift transition-all hover:-translate-y-0.5 flex gap-4 items-center p-5"
            >
              {/* Visual preview pill */}
              <div
                className="w-20 h-20 rounded-2xl flex items-center justify-center text-4xl flex-shrink-0"
                style={{
                  background: `linear-gradient(135deg, ${c.gradient_from}, ${c.gradient_to})`,
                }}
              >
                {c.icon}
              </div>
              <div className="flex-1 min-w-0">
                <div className="flex items-center gap-2 flex-wrap">
                  <h3 className="font-display text-lg text-ink-primary truncate">{c.name}</h3>
                  {!c.is_active && (
                    <span className="text-[10px] uppercase font-bold bg-ink-soft/15 text-ink-soft px-2 py-0.5 rounded-full">
                      Inactiva
                    </span>
                  )}
                </div>
                <p className="text-xs text-ink-soft font-mono">/{c.slug}</p>
                <p className="text-sm text-ink-secondary mt-1">
                  {counts[c.id] ?? 0} producto{counts[c.id] === 1 ? "" : "s"}
                </p>
              </div>
              <ArrowRight className="w-5 h-5 text-ink-soft group-hover:text-rose-deep transition" />
            </Link>
          ))}
        </div>
      )}

      <div className="mt-10 card bg-rose-whisper/60">
        <h2 className="font-display text-xl text-ink-primary mb-2">💡 Tip</h2>
        <p className="text-sm text-ink-secondary">
          Las categorías que ves acá aparecen automáticamente en el home (web y mobile).
          El orden, color y emoji que elijas en cada una se refleja en tiempo real cuando alguien
          recargue. Activá/desactivá categorías sin borrarlas para esconderlas temporalmente
          (los productos asociados no se pierden).
        </p>
      </div>
    </div>
  );
}
