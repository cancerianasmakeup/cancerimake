import Link from "next/link";
import { Plus, Edit, Eye } from "lucide-react";
import { createSupabaseServer } from "@/lib/supabase-server";
import { formatPrice } from "@cancerianas/shared";

export const dynamic = "force-dynamic";

export default async function AdminProducts() {
  const supabase = await createSupabaseServer();
  const { data: products } = await supabase
    .from("products")
    .select("*, product_categories(is_primary, category:categories(name))")
    .order("created_at", { ascending: false });

  return (
    <div className="max-w-6xl">
      <div className="flex items-center justify-between mb-8">
        <div>
          <h1 className="font-display text-3xl md:text-4xl text-ink-primary">Productos</h1>
          <p className="text-ink-secondary mt-1">{products?.length ?? 0} productos en total</p>
        </div>
        <Link href="/admin/products/new" className="btn-primary">
          <Plus className="w-4 h-4" /> Nuevo
        </Link>
      </div>

      <div className="card overflow-x-auto p-0">
        <table className="w-full text-sm">
          <thead className="bg-rose-whisper">
            <tr className="text-left text-ink-soft uppercase text-xs">
              <th className="p-4">Producto</th>
              <th className="p-4">Categoría</th>
              <th className="p-4">Precio</th>
              <th className="p-4">Stock</th>
              <th className="p-4">Estado</th>
              <th className="p-4"></th>
            </tr>
          </thead>
          <tbody>
            {products?.map((p: any) => (
              <tr key={p.id} className="border-t border-rose-pastel hover:bg-rose-whisper/50">
                <td className="p-4">
                  <div className="flex items-center gap-3">
                    {p.images?.[0] ? (
                      <img src={p.images[0]} alt="" className="w-12 h-12 rounded-xl object-cover" />
                    ) : (
                      <div className="w-12 h-12 rounded-xl bg-rose-pastel flex items-center justify-center">🌸</div>
                    )}
                    <div>
                      <div className="font-semibold text-ink-primary">{p.name}</div>
                      <div className="text-xs text-ink-soft">/{p.slug}</div>
                    </div>
                  </div>
                </td>
                <td className="p-4 text-ink-secondary">
                  {(() => {
                    const links = (p.product_categories ?? []) as Array<{ is_primary: boolean; category: { name: string } | null }>;
                    const primary = links.find((l) => l.is_primary)?.category?.name;
                    const others = links.filter((l) => !l.is_primary).map((l) => l.category?.name).filter(Boolean);
                    if (!primary && others.length === 0) return "—";
                    return (
                      <>
                        <span>{primary ?? others[0]}</span>
                        {others.length > 0 && primary && (
                          <span className="text-xs text-ink-soft ml-1">+{others.length}</span>
                        )}
                      </>
                    );
                  })()}
                </td>
                <td className="p-4 font-semibold">{formatPrice(p.price)}</td>
                <td className="p-4">
                  <span className={p.stock <= 3 ? "text-error font-bold" : "text-ink-secondary"}>
                    {p.stock}
                  </span>
                </td>
                <td className="p-4">
                  <span className={`text-xs font-bold uppercase px-2 py-1 rounded-full ${
                    p.status === "active" ? "bg-success/30 text-ink-primary" :
                    p.status === "draft" ? "bg-warning/30 text-ink-primary" :
                    "bg-ink-soft/20 text-ink-soft"
                  }`}>
                    {p.status === "active" ? "activo" : p.status === "draft" ? "borrador" : "archivado"}
                  </span>
                </td>
                <td className="p-4 text-right">
                  <Link href={`/product/${p.slug}`} className="inline-flex p-2 hover:bg-rose-pastel rounded-full" target="_blank">
                    <Eye className="w-4 h-4" />
                  </Link>
                  <Link href={`/admin/products/${p.id}`} className="inline-flex p-2 hover:bg-rose-pastel rounded-full">
                    <Edit className="w-4 h-4" />
                  </Link>
                </td>
              </tr>
            ))}
            {(!products || products.length === 0) && (
              <tr>
                <td colSpan={6} className="text-center py-16 text-ink-soft">
                  Todavía no hay productos. <Link href="/admin/products/new" className="text-rose-deep font-semibold">Creá el primero →</Link>
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </div>
    </div>
  );
}
