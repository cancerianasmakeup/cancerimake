// Edge Function: create-payment-preference
// Crea una preferencia de pago en Mercado Pago para:
//  - una orden de catálogo (order_id)
//  - una compra de LIVE (live_purchase_id)
//
// Devuelve init_point (URL de Checkout Pro) para abrir en WebView/redirect.

import {
  corsHeaders, getSupabaseAdmin, getSupabaseFromRequest,
  mpRequest, jsonResponse
} from "../_shared/utils.ts";

interface RequestBody {
  type: "order" | "live_purchase" | "shipment";
  id: string;
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response("ok", { headers: corsHeaders });
  }

  try {
    // Validar usuario autenticado
    const supabaseUser = getSupabaseFromRequest(req);
    const { data: { user }, error: authError } = await supabaseUser.auth.getUser();
    if (authError || !user) {
      return jsonResponse({ error: "unauthorized" }, 401);
    }

    const body: RequestBody = await req.json();
    const supabase = getSupabaseAdmin();
    const baseUrl = Deno.env.get("SITE_URL") ?? "https://cancerianas.app";

    let preferencePayload: any;
    let updateTable: "orders" | "live_purchases";
    let updateId: string;

    if (body.type === "order") {
      // === FLUJO CATÁLOGO ===
      const { data: order, error } = await supabase
        .from("orders")
        .select("*, order_items(*), profiles(email, full_name, phone)")
        .eq("id", body.id)
        .eq("user_id", user.id)
        .single();

      if (error || !order) return jsonResponse({ error: "order_not_found" }, 404);
      if (order.status !== "pending") return jsonResponse({ error: "invalid_order_status" }, 400);

      preferencePayload = {
        items: order.order_items.map((it: any) => ({
          id: it.id,
          title: it.description,
          quantity: it.quantity,
          currency_id: "ARS",
          unit_price: Number(it.unit_price),
          picture_url: it.image_url,
        })),
        payer: {
          email: order.profiles.email,
          name: order.profiles.full_name?.split(" ")[0] ?? "",
          surname: order.profiles.full_name?.split(" ").slice(1).join(" ") ?? "",
        },
        back_urls: {
          success: `${baseUrl}/orders/${order.id}?status=success`,
          failure: `${baseUrl}/orders/${order.id}?status=failure`,
          pending: `${baseUrl}/orders/${order.id}?status=pending`,
        },
        auto_return: "approved",
        external_reference: `order:${order.id}`,
        notification_url: `${Deno.env.get("SUPABASE_URL")}/functions/v1/webhook-mercadopago`,
        metadata: { order_id: order.id, type: "order" },
      };

      if (order.shipping_cost > 0) {
        preferencePayload.items.push({
          id: "shipping",
          title: "Envío",
          quantity: 1,
          currency_id: "ARS",
          unit_price: Number(order.shipping_cost),
        });
      }

      updateTable = "orders";
      updateId = order.id;

    } else if (body.type === "live_purchase") {
      // === FLUJO LIVE ===
      const { data: purchase, error } = await supabase
        .from("live_purchases")
        .select("*, live_offers(*), live_events(*), profiles(email, full_name)")
        .eq("id", body.id)
        .eq("user_id", user.id)
        .single();

      if (error || !purchase) return jsonResponse({ error: "purchase_not_found" }, 404);
      if (purchase.status !== "paying") return jsonResponse({ error: "invalid_purchase_status" }, 400);

      const expiresAt = new Date(purchase.reserved_until).toISOString();

      preferencePayload = {
        items: [{
          id: purchase.id,
          title: `${purchase.live_offers.name} — ${purchase.live_events.title}`,
          description: "Cancerianas LIVE",
          quantity: 1,
          currency_id: "ARS",
          unit_price: Number(purchase.amount),
          picture_url: purchase.live_offers.image_url || purchase.live_events.cover_image,
        }],
        payer: {
          email: purchase.profiles.email,
          name: purchase.profiles.full_name?.split(" ")[0] ?? "",
        },
        back_urls: {
          success: `${baseUrl}/live/${purchase.event_id}?purchase=${purchase.id}&status=success`,
          failure: `${baseUrl}/live/${purchase.event_id}?purchase=${purchase.id}&status=failure`,
          pending: `${baseUrl}/live/${purchase.event_id}?purchase=${purchase.id}&status=pending`,
        },
        auto_return: "approved",
        external_reference: `live_purchase:${purchase.id}`,
        notification_url: `${Deno.env.get("SUPABASE_URL")}/functions/v1/webhook-mercadopago`,
        expires: true,
        expiration_date_to: expiresAt,
        metadata: {
          live_purchase_id: purchase.id,
          live_event_id: purchase.event_id,
          type: "live_purchase",
        },
      };

      updateTable = "live_purchases";
      updateId = purchase.id;

    } else if (body.type === "shipment") {
      // === FLUJO ENVÍO ===
      const { data: shipment, error } = await supabase
        .from("shipments")
        .select("*, profiles!user_id(email, full_name)")
        .eq("id", body.id)
        .eq("user_id", user.id)
        .single();

      if (error || !shipment) return jsonResponse({ error: "shipment_not_found" }, 404);
      if (shipment.status !== "pending_payment") {
        return jsonResponse({ error: "invalid_shipment_status" }, 400);
      }

      preferencePayload = {
        items: [{
          id: shipment.id,
          title: `Envío Andreani — ${shipment.description}`,
          description: shipment.destination_type === "sucursal" ? "Retira en sucursal" : "Envío a domicilio",
          quantity: 1,
          currency_id: "ARS",
          unit_price: Number(shipment.cost_charged),
        }],
        payer: {
          email: shipment.profiles.email,
          name: shipment.profiles.full_name?.split(" ")[0] ?? "",
        },
        back_urls: {
          success: `${baseUrl}/shipment/${shipment.id}?status=success`,
          failure: `${baseUrl}/shipment/${shipment.id}?status=failure`,
          pending: `${baseUrl}/shipment/${shipment.id}?status=pending`,
        },
        auto_return: "approved",
        external_reference: `shipment:${shipment.id}`,
        notification_url: `${Deno.env.get("SUPABASE_URL")}/functions/v1/webhook-mercadopago`,
        metadata: { shipment_id: shipment.id, type: "shipment" },
      };

      updateTable = "shipments" as any;
      updateId = shipment.id;

    } else {
      return jsonResponse({ error: "invalid_type" }, 400);
    }

    // Crear preferencia en MP
    const preference = await mpRequest("/checkout/preferences", {
      method: "POST",
      body: JSON.stringify(preferencePayload),
    });

    // Guardar referencias en la tabla correspondiente
    await supabase
      .from(updateTable)
      .update({
        mp_preference_id: preference.id,
        ...(updateTable === "live_purchases" ? { mp_init_point: preference.init_point } : {}),
      })
      .eq("id", updateId);

    return jsonResponse({
      preference_id: preference.id,
      init_point: preference.init_point,
      sandbox_init_point: preference.sandbox_init_point,
    });

  } catch (error: any) {
    console.error("[create-payment-preference] error:", error);
    return jsonResponse({ error: error.message }, 500);
  }
});
