import { createSupabaseServer } from "@/lib/supabase-server";
import AdminProductsBrowser from "@/components/AdminProductsBrowser";

export const dynamic = "force-dynamic";

export default async function AdminProducts() {
  const supabase = await createSupabaseServer();

  const [{ data: products }, { data: categories }] = await Promise.all([
    supabase
      .from("products")
      .select(
        "id, name, slug, price, compare_price, stock, sku, images, status, weight_grams, product_categories(category_id, is_primary, category:categories(id, name))"
      )
      .order("created_at", { ascending: false }),
    supabase
      .from("categories")
      .select("id, name")
      .eq("is_active", true)
      .order("display_order"),
  ]);

  return (
    <AdminProductsBrowser
      products={(products as any) ?? []}
      categories={(categories as any) ?? []}
    />
  );
}
