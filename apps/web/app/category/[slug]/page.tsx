import { notFound } from "next/navigation";
import { createSupabaseServer } from "@/lib/supabase-server";
import Header from "@/components/Header";
import Footer from "@/components/Footer";
import ProductCard from "@/components/ProductCard";
import StoreGate from "@/components/StoreGate";
import DropCountdownStrip from "@/components/DropCountdownStrip";
import type { Product, Category } from "@cancerianas/shared";

export const dynamic = "force-dynamic";

export default async function CategoryPage({
  params,
}: {
  params: Promise<{ slug: string }>;
}) {
  return (
    <StoreGate>
      <CategoryContent params={params} />
    </StoreGate>
  );
}

async function CategoryContent({
  params,
}: {
  params: Promise<{ slug: string }>;
}) {
  const { slug } = await params;
  const supabase = await createSupabaseServer();

  const { data: category } = await supabase
    .from("categories")
    .select("*")
    .eq("slug", slug)
    .single();

  if (!category) notFound();

  const { data: products } = await supabase
    .from("products")
    .select("*, variants:product_variants(id)")
    .eq("category_id", category.id)
    .eq("status", "active")
    .order("created_at", { ascending: false });

  return (
    <>
      <Header />
      <DropCountdownStrip />

      <section className="max-w-6xl mx-auto px-4 py-10">
        <div className="mb-8">
          <p className="text-rose-deep font-semibold uppercase tracking-wider text-sm mb-2">Categoría</p>
          <h1 className="font-display text-4xl md:text-6xl text-ink-primary">
            {(category as Category).name}
          </h1>
          <p className="text-ink-secondary mt-2">
            {(products as Product[] | null)?.length ?? 0} productos
          </p>
        </div>

        {(products as Product[] | null)?.length ? (
          <div className="grid grid-cols-2 md:grid-cols-4 gap-4 md:gap-6">
            {(products as Product[]).map((p) => (
              <ProductCard key={p.id} product={p} />
            ))}
          </div>
        ) : (
          <div className="card text-center py-20">
            <div className="text-6xl mb-4">🌸</div>
            <p className="text-ink-secondary">Todavía no hay productos en esta categoría.</p>
          </div>
        )}
      </section>

      <Footer />
    </>
  );
}
