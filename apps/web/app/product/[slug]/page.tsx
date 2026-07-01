import { notFound } from "next/navigation";
import { createSupabaseServer } from "@/lib/supabase-server";
import Header from "@/components/Header";
import Footer from "@/components/Footer";
import AddToCartButton from "@/components/AddToCartButton";
import StoreGate from "@/components/StoreGate";
import QueueGateServer from "@/components/QueueGateServer";
import DropCountdownStrip from "@/components/DropCountdownStrip";
import ProductGallery from "@/components/ProductGallery";
import ProductDescription from "@/components/ProductDescription";
import RelatedProducts from "@/components/RelatedProducts";
import { formatPrice, sanitizeWholesaleTiers } from "@cancerianas/shared";
import type { Product, ProductVariant } from "@cancerianas/shared";

export const dynamic = "force-dynamic";

export default async function ProductPage({
  params,
}: {
  params: Promise<{ slug: string }>;
}) {
  return (
    <StoreGate>
      <QueueGateServer page="product" />
      <ProductContent params={params} />
    </StoreGate>
  );
}

async function ProductContent({
  params,
}: {
  params: Promise<{ slug: string }>;
}) {
  const { slug } = await params;
  const supabase = await createSupabaseServer();

  const { data: product } = await supabase
    .from("products")
    .select("*")
    .eq("slug", slug)
    .eq("status", "active")
    .single();

  if (!product) notFound();

  // Categorías del producto (puede tener varias). Primary va para breadcrumb.
  const { data: productCategories } = await supabase
    .from("product_categories")
    .select("is_primary, category:categories(id, name, slug)")
    .eq("product_id", product.id);

  const categoryLinks = ((productCategories ?? []) as unknown) as Array<{
    is_primary: boolean;
    category: { id: string; name: string; slug: string } | null;
  }>;
  const primaryCategory =
    categoryLinks.find((l) => l.is_primary)?.category ??
    categoryLinks[0]?.category ??
    null;
  const productCategoryIds = categoryLinks.map((l) => l.category?.id).filter(Boolean) as string[];

  const { data: variants } = await supabase
    .from("product_variants")
    .select("*")
    .eq("product_id", product.id);

  // Productos similares: comparten al menos una categoría con el actual.
  let related: Product[] = [];
  if (productCategoryIds.length > 0) {
    const { data: relatedLinks } = await supabase
      .from("product_categories")
      .select("product_id")
      .in("category_id", productCategoryIds)
      .neq("product_id", product.id);

    const relatedIds = Array.from(new Set((relatedLinks ?? []).map((r) => r.product_id)));
    if (relatedIds.length > 0) {
      const { data } = await supabase
        .from("products")
        .select("*")
        .eq("status", "active")
        .in("id", relatedIds)
        .order("is_featured", { ascending: false })
        .limit(12);
      related = (data as Product[] | null) ?? [];
    }
  }

  // Si hay pocos de la misma categoría completar con featured de cualquier categoría
  let relatedProducts: Product[] = related;
  if (relatedProducts.length < 4) {
    const { data: featured } = await supabase
      .from("products")
      .select("*")
      .eq("status", "active")
      .neq("id", product.id)
      .eq("is_featured", true)
      .limit(12);
    const featuredList = (featured as Product[] | null) ?? [];
    const existingIds = new Set(relatedProducts.map((p) => p.id));
    relatedProducts = [...relatedProducts, ...featuredList.filter((p) => !existingIds.has(p.id))].slice(0, 12);
  }

  const p = { ...(product as Product), category: primaryCategory } as Product & {
    category: { name: string; slug: string } | null;
  };
  const hasDiscount = !!(p.compare_price && p.compare_price > p.price);
  const discountPct = hasDiscount ? Math.round((1 - p.price / p.compare_price!) * 100) : 0;

  // Título con jerarquía: "Nombre — Detalle — Marca (código)" →
  //   principal = "Nombre", subtítulo = "Detalle · Marca", código aparte.
  const codeMatch = p.name.match(/\s*\(([^)]+)\)\s*$/);
  const itemCode = codeMatch ? codeMatch[1] : null;
  const nameNoCode = codeMatch ? p.name.slice(0, codeMatch.index).trimEnd() : p.name;
  const nameParts = nameNoCode.split(/\s+—\s+/);
  const mainName = nameParts[0];
  const subName = nameParts.slice(1).join(" · ");

  return (
    <>
      <Header />
      <DropCountdownStrip />

      {/* Sección principal con video de fondo */}
      <section className="relative overflow-hidden">
        {/* Video de fondo en loop */}
        <video
          autoPlay
          loop
          muted
          playsInline
          preload="none"
          className="absolute inset-0 w-full h-full object-cover pointer-events-none"
          src="https://pub-4ee8d6afe02b441fa29b28b501f5a6be.r2.dev/hero-bg.mp4"
        />
        {/* Overlay blanco suave para que el contenido sea legible */}
        <div className="absolute inset-0 bg-white/82 backdrop-blur-[2px]" />

        <div className="relative max-w-6xl mx-auto px-4 py-8 md:py-12">
          {p.category && (
            <p className="text-[11px] uppercase tracking-[0.22em] text-rose-deep/80 font-semibold mb-6">
              <a href={`/category/${p.category.slug}`} className="hover:text-rose-deep transition-colors">{p.category.name}</a>
            </p>
          )}

          <div className="grid md:grid-cols-2 gap-10 lg:gap-14">
            {/* Galería: imágenes + videos del fabricante */}
            <ProductGallery images={p.images ?? []} videos={p.videos ?? []} alt={p.name} />

            {/* Info */}
            <div className="md:pt-2">
              {/* Título con jerarquía editorial */}
              <h1 className="font-accent font-medium text-4xl md:text-6xl text-ink-primary leading-[1.02] mb-2">
                {mainName}
              </h1>
              {subName && (
                <p className="text-ink-secondary text-base md:text-lg tracking-wide leading-snug mb-1.5">
                  {subName}
                </p>
              )}
              {itemCode && (
                <p className="text-[10px] uppercase tracking-[0.25em] text-ink-soft/70 mb-6">
                  Ítem {itemCode}
                </p>
              )}

              {/* Precio */}
              <div className="flex items-end gap-3 mb-6">
                <span className="font-accent font-semibold text-5xl md:text-[3.25rem] leading-none text-rose-deep">
                  {formatPrice(p.price)}
                </span>
                {hasDiscount && (
                  <div className="flex flex-col leading-tight pb-1">
                    <span className="text-ink-soft/70 text-lg line-through">
                      {formatPrice(p.compare_price!)}
                    </span>
                    <span className="inline-flex items-center gap-1 text-[11px] font-bold tracking-wide text-rose-deep">
                      <span className="bg-rose-pastel rounded-full px-2 py-0.5">−{discountPct}% OFF</span>
                    </span>
                  </div>
                )}
              </div>

              {/* Divisor delicado */}
              <div className="h-px w-full bg-gradient-to-r from-rose-medium/50 via-rose-pastel to-transparent mb-6" />

              {/* Comprar — el selector va justo debajo del precio */}
              {p.stock === 0 ? (
                <div className="rounded-3xl border border-rose-pastel bg-rose-whisper/60 text-center py-7 px-6">
                  <p className="font-accent text-2xl text-ink-primary">Agotado por ahora 🌸</p>
                  <p className="text-ink-soft text-sm mt-1">Volvé a chequear pronto, repongo seguido.</p>
                </div>
              ) : (
                <AddToCartButton
                  productId={p.id}
                  price={p.price}
                  stock={p.stock}
                  variants={(variants as ProductVariant[] | null) ?? []}
                  wholesaleTiers={sanitizeWholesaleTiers(p.wholesale_tiers)}
                />
              )}
            </div>
          </div>
        </div>
      </section>

      {/* Descripción del producto — debajo del comprador */}
      {p.description && (
        <section className="max-w-3xl mx-auto px-4 py-10 md:py-14">
          <h2 className="font-accent text-3xl text-ink-primary mb-1">Sobre el producto</h2>
          <span className="block w-12 h-px bg-rose-medium mb-6" />
          <ProductDescription text={p.description} />
        </section>
      )}

      {/* Info de envío — fuera del fondo animado */}
      <div className="max-w-6xl mx-auto px-4 py-6">
        <div className="flex flex-wrap justify-center gap-x-8 gap-y-2 text-sm text-ink-secondary border-t border-rose-pastel pt-6">
          <p>🌸 Envío a todo el país</p>
          <p>💗 Pago seguro con Mercado Pago</p>
          <p>✨ Cambios y devoluciones por WhatsApp</p>
        </div>
      </div>

      <RelatedProducts products={relatedProducts} />

      <Footer />
    </>
  );
}
