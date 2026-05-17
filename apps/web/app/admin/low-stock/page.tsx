import Link from "next/link";
import { AlertTriangle, ArrowRight, Package } from "lucide-react";
import { createSupabaseServer } from "@/lib/supabase-server";

export const dynamic = "force-dynamic";

const LOW_THRESHOLD = 3;

export default async function LowStockPage() {
  const supabase = await createSupabaseServer();

  // Productos con stock global ≤3 (puede ser un producto sin variantes, o uno
  // con variantes donde la suma de variantes ≤3 — el trigger ya lo sincroniza).
  const { data: products } = await supabase
    .from("products")
    .select("id, name, slug, images, stock, status, product_variants(id, name, stock, attributes)")
    .lte("stock", LOW_THRESHOLD)
    .neq("status", "archived")
    .order("stock", { ascending: true });

  // Variantes con stock ≤3 individualmente (importa aunque el producto total
  // tenga más, porque un tono específico puede estar agotándose).
  const { data: lowVariants } = await supabase
    .from("product_variants")
    .select("id, name, stock, attributes, product:products(id, name, slug, images, status)")
    .lte("stock", LOW_THRESHOLD)
    .order("stock", { ascending: true });

  const lowProducts = (products ?? []) as any[];
  const lowVariantList = ((lowVariants ?? []) as any[]).filter(
    (v) => v.product && v.product.status !== "archived"
  );

  const total = lowProducts.length + lowVariantList.length;

  return (
    <div className="max-w-6xl space-y-6">
      <div className="flex items-center justify-between flex-wrap gap-3">
        <div>
          <h1 className="font-display text-3xl md:text-4xl text-ink-primary flex items-center gap-2">
            <AlertTriangle className="w-7 h-7 text-warning" />
            Poco stock
          </h1>
          <p className="text-ink-secondary mt-1">
            {total === 0
              ? "Ningún producto con stock crítico 🌸"
              : `${total} ${total === 1 ? "item" : "items"} con stock ≤ ${LOW_THRESHOLD}`}
          </p>
        </div>
        <Link href="/admin/products" className="btn-secondary text-sm">
          Ver todos los productos
        </Link>
      </div>

      {/* Productos sin variantes (o productos con stock total bajo) */}
      {lowProducts.length > 0 && (
        <div className="card p-0 overflow-x-auto">
          <div className="p-4 border-b border-rose-pastel">
            <h2 className="font-display text-lg">Productos con stock total bajo</h2>
            <p className="text-xs text-ink-soft mt-0.5">
              Stock global del producto ≤ {LOW_THRESHOLD}. Si tiene variantes, es la suma de todas.
            </p>
          </div>
          <table className="w-full text-sm">
            <thead className="bg-rose-whisper">
              <tr className="text-left text-ink-soft uppercase text-[10px] tracking-wider">
                <th className="p-3">Producto</th>
                <th className="p-3 text-right">Stock</th>
                <th className="p-3"></th>
              </tr>
            </thead>
            <tbody>
              {lowProducts.map((p) => {
                const stockLevel =
                  p.stock === 0 ? "AGOTADO" : p.stock === 1 ? "CRÍTICO" : "BAJO";
                const stockColor =
                  p.stock === 0
                    ? "bg-error/20 text-error"
                    : p.stock === 1
                      ? "bg-warning/30 text-ink-primary"
                      : "bg-warning/15 text-ink-secondary";
                return (
                  <tr
                    key={p.id}
                    className="border-t border-rose-pastel hover:bg-rose-whisper/50 transition"
                  >
                    <td className="p-3">
                      <Link
                        href={`/admin/products/${p.id}`}
                        className="flex items-center gap-3 group"
                      >
                        {p.images?.[0] ? (
                          <img
                            src={p.images[0]}
                            alt=""
                            className="w-12 h-12 rounded-xl object-cover flex-shrink-0"
                          />
                        ) : (
                          <div className="w-12 h-12 rounded-xl bg-rose-pastel flex items-center justify-center flex-shrink-0">
                            <Package className="w-5 h-5 text-rose-deep" />
                          </div>
                        )}
                        <div className="min-w-0">
                          <p className="font-semibold text-ink-primary group-hover:text-rose-deep transition">
                            {p.name}
                          </p>
                          <p className="text-xs text-ink-soft">/{p.slug}</p>
                          {p.product_variants && p.product_variants.length > 0 && (
                            <p className="text-[10px] text-ink-soft mt-0.5">
                              {p.product_variants.length} variante
                              {p.product_variants.length === 1 ? "" : "s"}
                            </p>
                          )}
                        </div>
                      </Link>
                    </td>
                    <td className="p-3 text-right">
                      <span
                        className={`inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full font-bold text-xs ${stockColor}`}
                      >
                        {p.stock} · {stockLevel}
                      </span>
                    </td>
                    <td className="p-3 text-right">
                      <Link
                        href={`/admin/products/${p.id}`}
                        className="inline-flex items-center gap-1 text-rose-deep hover:underline font-semibold text-xs"
                      >
                        Editar <ArrowRight className="w-3 h-3" />
                      </Link>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      )}

      {/* Variantes específicas con stock bajo */}
      {lowVariantList.length > 0 && (
        <div className="card p-0 overflow-x-auto">
          <div className="p-4 border-b border-rose-pastel">
            <h2 className="font-display text-lg">Variantes/tonos con stock bajo</h2>
            <p className="text-xs text-ink-soft mt-0.5">
              Tonos o colores específicos que se están agotando aunque el producto total tenga
              stock.
            </p>
          </div>
          <table className="w-full text-sm">
            <thead className="bg-rose-whisper">
              <tr className="text-left text-ink-soft uppercase text-[10px] tracking-wider">
                <th className="p-3">Producto · Variante</th>
                <th className="p-3 text-right">Stock</th>
                <th className="p-3"></th>
              </tr>
            </thead>
            <tbody>
              {lowVariantList.map((v) => {
                const stockLevel =
                  v.stock === 0 ? "AGOTADO" : v.stock === 1 ? "CRÍTICO" : "BAJO";
                const stockColor =
                  v.stock === 0
                    ? "bg-error/20 text-error"
                    : v.stock === 1
                      ? "bg-warning/30 text-ink-primary"
                      : "bg-warning/15 text-ink-secondary";
                const colorHex = v.attributes?.color_hex;
                return (
                  <tr
                    key={v.id}
                    className="border-t border-rose-pastel hover:bg-rose-whisper/50 transition"
                  >
                    <td className="p-3">
                      <Link
                        href={`/admin/products/${v.product.id}`}
                        className="flex items-center gap-3 group"
                      >
                        {v.product.images?.[0] ? (
                          <img
                            src={v.product.images[0]}
                            alt=""
                            className="w-12 h-12 rounded-xl object-cover flex-shrink-0"
                          />
                        ) : (
                          <div className="w-12 h-12 rounded-xl bg-rose-pastel flex items-center justify-center flex-shrink-0">
                            <Package className="w-5 h-5 text-rose-deep" />
                          </div>
                        )}
                        <div className="min-w-0">
                          <p className="font-semibold text-ink-primary group-hover:text-rose-deep transition truncate">
                            {v.product.name}
                          </p>
                          <p className="text-sm text-ink-secondary flex items-center gap-2 mt-0.5">
                            {colorHex && (
                              <span
                                className="inline-block w-4 h-4 rounded-full border border-rose-pastel"
                                style={{ backgroundColor: colorHex }}
                              />
                            )}
                            <span>{v.name}</span>
                          </p>
                        </div>
                      </Link>
                    </td>
                    <td className="p-3 text-right">
                      <span
                        className={`inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full font-bold text-xs ${stockColor}`}
                      >
                        {v.stock} · {stockLevel}
                      </span>
                    </td>
                    <td className="p-3 text-right">
                      <Link
                        href={`/admin/products/${v.product.id}`}
                        className="inline-flex items-center gap-1 text-rose-deep hover:underline font-semibold text-xs"
                      >
                        Editar <ArrowRight className="w-3 h-3" />
                      </Link>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      )}

      {total === 0 && (
        <div className="card text-center py-16">
          <div className="text-6xl mb-4">🌸</div>
          <p className="text-ink-secondary">Todo bien con el stock — ningún producto crítico.</p>
        </div>
      )}
    </div>
  );
}
