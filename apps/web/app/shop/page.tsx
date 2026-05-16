// /shop — vidriera completa de la tienda.
// - Banner de destacados (más vendidos / featured) arriba
// - Buscador en vivo + selector de categorías
// - Grilla de todos los productos activos con filtros aplicables vía query params

import ShopBrowser from "@/components/ShopBrowser";
import Header from "@/components/Header";
import Footer from "@/components/Footer";
import StoreGate from "@/components/StoreGate";
import DropCountdownStrip from "@/components/DropCountdownStrip";
import { createSupabaseServer } from "@/lib/supabase-server";
import type { Product, Category } from "@cancerianas/shared";

export const dynamic = "force-dynamic";

export const metadata = {
  title: "Tienda",
  description:
    "Cosmética, accesorios y promos elegidos a mano. Buscá tu favorito o explorá por categoría.",
};

export default async function ShopPage({
  searchParams,
}: {
  searchParams?: Promise<{ q?: string; cat?: string; sort?: string }>;
}) {
  return (
    <StoreGate>
      <ShopContent searchParams={searchParams} />
    </StoreGate>
  );
}

async function ShopContent({
  searchParams,
}: {
  searchParams?: Promise<{ q?: string; cat?: string; sort?: string }>;
}) {
  const supabase = await createSupabaseServer();
  const params = (await searchParams) ?? {};

  const [{ data: featured }, { data: categories }, { data: allProducts }] =
    await Promise.all([
      supabase
        .from("products")
        .select("*, variants:product_variants(id)")
        .eq("status", "active")
        .eq("is_featured", true)
        .order("created_at", { ascending: false })
        .limit(8),
      supabase
        .from("categories")
        .select("*")
        .eq("is_active", true)
        .order("display_order"),
      supabase
        .from("products")
        .select("*, category:categories(name, slug), variants:product_variants(id)")
        .eq("status", "active")
        .order("created_at", { ascending: false }),
    ]);

  return (
    <>
      <Header />
      <DropCountdownStrip />
      <ShopBrowser
        featured={(featured as Product[] | null) ?? []}
        categories={(categories as Category[] | null) ?? []}
        products={(allProducts as Product[] | null) ?? []}
        initialQ={params.q ?? ""}
        initialCat={params.cat ?? ""}
        initialSort={params.sort ?? "recent"}
      />
      <Footer />
    </>
  );
}
