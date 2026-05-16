import { notFound } from "next/navigation";
import { createSupabaseServer } from "@/lib/supabase-server";
import Header from "@/components/Header";
import Footer from "@/components/Footer";
import AddToCartButton from "@/components/AddToCartButton";
import StoreGate from "@/components/StoreGate";
import QueueGateServer from "@/components/QueueGateServer";
import DropCountdownStrip from "@/components/DropCountdownStrip";
import ProductGallery from "@/components/ProductGallery";
import RelatedProducts from "@/components/RelatedProducts";
import { formatPrice } from "@cancerianas/shared";
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
  const hasDiscount = p.compare_price && p.compare_price > p.price;

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
            <p className="text-sm text-ink-soft mb-4">
              <a href={`/category/${p.category.slug}`} className="hover:text-rose-deep">{p.category.name}</a>
            </p>
          )}

          <div className="grid md:grid-cols-2 gap-10">
            {/* Galería: imágenes + videos del fabricante */}
            <ProductGallery images={p.images ?? []} videos={p.videos ?? []} alt={p.name} />

            {/* Info */}
            <div>
              <h1 className="font-display text-3xl md:text-5xl text-ink-primary leading-tight mb-4">
                {p.name}
              </h1>

              <div className="flex items-baseline gap-3 mb-6">
                <span className="font-display font-bold text-4xl text-rose-deep">
                  {formatPrice(p.price)}
                </span>
                {hasDiscount && (
                  <span className="text-ink-soft text-xl line-through">
                    {formatPrice(p.compare_price!)}
                  </span>
                )}
              </div>

              {p.description && (
                <p className="text-center text-sm leading-relaxed mb-8 whitespace-pre-line font-medium tracking-wide text-ink-secondary" style={{ fontWeight: 500, letterSpacing: "0.01em" }}>
                  {p.description}
                </p>
              )}

              {p.stock === 0 ? (
                <div className="card bg-rose-pastel text-center py-6">
                  <p className="font-semibold text-ink-primary">Sin stock por ahora 🌸</p>
                  <p className="text-ink-soft text-sm mt-1">Volvé a chequear pronto, repongo seguido.</p>
                </div>
              ) : (
                <AddToCartButton
                  productId={p.id}
                  price={p.price}
                  variants={(variants as ProductVariant[] | null) ?? []}
                />
              )}
            </div>
          </div>
        </div>
      </section>

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
