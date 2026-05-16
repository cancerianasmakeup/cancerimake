// Helper compartido para agregar items al carrito.
// Usado por AddToCartButton (producto detail) y QuickAddButton (cards).
// - Crea cart si no existe (status='active')
// - Si ya hay un cart_item con mismo product+variant, suma quantity
// - Si no, inserta una línea nueva

import type { SupabaseClient } from "@supabase/supabase-js";

export type AddItemOpts = {
  userId: string;
  productId: string;
  variantId: string | null;
  quantity: number;
  unitPrice: number;
};

export async function addItemToCart(
  supabase: SupabaseClient,
  opts: AddItemOpts
): Promise<void> {
  // 1) Resolver carrito activo (crear si no existe)
  let { data: cart, error: cartErr } = await supabase
    .from("carts")
    .select("id")
    .eq("user_id", opts.userId)
    .eq("status", "active")
    .maybeSingle();
  if (cartErr) throw cartErr;

  if (!cart) {
    const { data: newCart, error: newCartErr } = await supabase
      .from("carts")
      .insert({ user_id: opts.userId })
      .select("id")
      .single();
    if (newCartErr) throw newCartErr;
    cart = newCart;
  }
  if (!cart) throw new Error("No se pudo crear el carrito");

  // 2) Buscar línea existente (mismo producto + misma variante, o ambos null)
  const baseQuery = supabase
    .from("cart_items")
    .select("id, quantity")
    .eq("cart_id", cart.id)
    .eq("product_id", opts.productId);

  const { data: existing } = opts.variantId
    ? await baseQuery.eq("variant_id", opts.variantId).maybeSingle()
    : await baseQuery.is("variant_id", null).maybeSingle();

  if (existing) {
    const { error: updErr } = await supabase
      .from("cart_items")
      .update({ quantity: existing.quantity + opts.quantity })
      .eq("id", existing.id);
    if (updErr) throw updErr;
  } else {
    const { error: insErr } = await supabase.from("cart_items").insert({
      cart_id: cart.id,
      product_id: opts.productId,
      variant_id: opts.variantId,
      quantity: opts.quantity,
      unit_price: opts.unitPrice,
    });
    if (insErr) throw insErr;
  }
}

// Restar 1 a una línea existente. Si baja a 0 se elimina la línea entera.
export async function removeOneFromCart(
  supabase: SupabaseClient,
  opts: { userId: string; productId: string; variantId: string | null }
): Promise<{ newQty: number; deleted: boolean }> {
  const { data: cart } = await supabase
    .from("carts")
    .select("id")
    .eq("user_id", opts.userId)
    .eq("status", "active")
    .maybeSingle();
  if (!cart) return { newQty: 0, deleted: true };

  const baseQ = supabase
    .from("cart_items")
    .select("id, quantity")
    .eq("cart_id", cart.id)
    .eq("product_id", opts.productId);

  const { data: line } = opts.variantId
    ? await baseQ.eq("variant_id", opts.variantId).maybeSingle()
    : await baseQ.is("variant_id", null).maybeSingle();

  if (!line) return { newQty: 0, deleted: true };

  if (line.quantity <= 1) {
    const { error } = await supabase.from("cart_items").delete().eq("id", line.id);
    if (error) throw error;
    return { newQty: 0, deleted: true };
  }

  const { error } = await supabase
    .from("cart_items")
    .update({ quantity: line.quantity - 1 })
    .eq("id", line.id);
  if (error) throw error;
  return { newQty: line.quantity - 1, deleted: false };
}

// Agregar varios items de un mismo producto con distintas variantes en una sola operación.
export async function addItemsToCart(
  supabase: SupabaseClient,
  userId: string,
  items: Array<Omit<AddItemOpts, "userId">>
): Promise<void> {
  for (const it of items) {
    if (it.quantity <= 0) continue;
    await addItemToCart(supabase, { ...it, userId });
  }
}
