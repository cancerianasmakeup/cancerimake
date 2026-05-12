// Edge Function: webhook-mercadopago
// Recibe notificaciones de Mercado Pago cuando un pago cambia de estado.
// Es llamada automáticamente por MP. NO requiere autenticación de usuario.
//
// Flujo:
//  1. MP nos manda { type: "payment", data: { id: "..." } }
//  2. Consultamos el pago real a la API de MP (no confiar en el body)
//  3. Si está "approved" → llamamos a confirm_live_payment() o actualizamos orden
//  4. Realtime notifica automáticamente al cliente y al admin

import { corsHeaders, getSupabaseAdmin, mpRequest, jsonResponse } from "../_shared/utils.ts";
import { sendEmail, sendWhatsApp } from "../_shared/notify.ts";

const SITE_URL = Deno.env.get("SITE_URL") ?? "https://cancerianas.com.ar";
const BRAND_NAME = Deno.env.get("BRAND_NAME") ?? "Cancerianas";
const LOGO_URL = Deno.env.get("BRAND_LOGO_URL") ?? "";

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response("ok", { headers: corsHeaders });
  }

  try {
    const body = await req.json();
    console.log("[webhook-mp] received:", JSON.stringify(body));

    // MP envía notificaciones de varios tipos. Solo nos interesan los pagos.
    if (body.type !== "payment" && body.topic !== "payment") {
      return jsonResponse({ ok: true, ignored: true });
    }

    const paymentId = body.data?.id ?? body.resource?.split("/").pop();
    if (!paymentId) {
      return jsonResponse({ ok: false, error: "no_payment_id" }, 400);
    }

    // Consultar el pago real a MP (NO confiar en el payload del webhook)
    const payment = await mpRequest(`/v1/payments/${paymentId}`);
    console.log("[webhook-mp] payment status:", payment.status, "ref:", payment.external_reference);

    const supabase = getSupabaseAdmin();
    const externalRef: string = payment.external_reference || "";
    const [refType, refId] = externalRef.split(":");

    if (refType === "live_purchase") {
      // === FLUJO LIVE ===
      if (payment.status === "approved") {
        const { data, error } = await supabase.rpc("confirm_live_payment", {
          p_purchase_id: refId,
          p_mp_payment_id: String(payment.id),
        });

        if (error) {
          console.error("[webhook-mp] error confirming live:", error);
          return jsonResponse({ ok: false, error: error.message }, 500);
        }

        console.log("[webhook-mp] live purchase confirmed, order:", data);

      } else if (payment.status === "rejected" || payment.status === "cancelled") {
        // Liberar la reserva
        const { data: purchase } = await supabase
          .from("live_purchases")
          .select("offer_id, status")
          .eq("id", refId)
          .single();

        if (purchase && purchase.status === "paying") {
          await supabase
            .from("live_purchases")
            .update({ status: "cancelled", mp_payment_id: String(payment.id) })
            .eq("id", refId);

          // Decrementar reserved_count
          await supabase.rpc("expire_old_locks"); // limpia y avanza fila
        }
      }

    } else if (refType === "shipment") {
      // === FLUJO ENVÍO ===
      if (payment.status === "approved") {
        const { error } = await supabase.rpc("mark_shipment_paid", {
          p_shipment_id: refId,
          p_mp_payment_id: String(payment.id),
        });
        if (error) {
          console.error("[webhook-mp] error marking shipment paid:", error);
          return jsonResponse({ ok: false, error: error.message }, 500);
        }
        console.log("[webhook-mp] shipment paid:", refId);
      } else if (payment.status === "rejected" || payment.status === "cancelled") {
        await supabase
          .from("shipments")
          .update({ mp_payment_id: String(payment.id) })
          .eq("id", refId);
      }

    } else if (refType === "order") {
      // === FLUJO CATÁLOGO ===
      const newStatus =
        payment.status === "approved" ? "paid" :
        payment.status === "rejected" || payment.status === "cancelled" ? "cancelled" :
        "pending";

      const updates: any = {
        mp_payment_id: String(payment.id),
        mp_status: payment.status,
      };
      if (newStatus === "paid") updates.paid_at = new Date().toISOString();
      updates.status = newStatus;

      await supabase.from("orders").update(updates).eq("id", refId);

      // Si se pagó, descontar stock de productos + crear shipment + mandar link
      if (newStatus === "paid") {
        const { data: items } = await supabase
          .from("order_items")
          .select("product_id, variant_id, quantity, description, products(weight_grams, length_cm, width_cm, height_cm, name)")
          .eq("order_id", refId);

        for (const item of items ?? []) {
          if (item.variant_id) {
            await supabase.rpc("decrement_variant_stock", {
              p_variant_id: item.variant_id,
              p_qty: item.quantity,
            });
          } else if (item.product_id) {
            await supabase.rpc("decrement_product_stock", {
              p_product_id: item.product_id,
              p_qty: item.quantity,
            });
          }
        }

        // Crear shipment automático para el flujo deferred (catálogo)
        await createShipmentAndNotify(supabase, refId, items ?? []);
      }
    }

    return jsonResponse({ ok: true });

  } catch (error: any) {
    console.error("[webhook-mp] error:", error);
    // Devolver 200 igual para que MP no reintente infinito si el error es nuestro
    return jsonResponse({ ok: false, error: error.message });
  }
});

// ============================================================
// Helpers de auto-shipment para flujo catálogo
// ============================================================
async function createShipmentAndNotify(
  supabase: ReturnType<typeof getSupabaseAdmin>,
  orderId: string,
  items: any[]
) {
  try {
    // Si ya hay un shipment ligado a esta order, no duplicar (idempotencia ante reintentos de webhook)
    const { data: existing } = await supabase
      .from("shipments")
      .select("id")
      .eq("order_id", orderId)
      .maybeSingle();
    if (existing) {
      console.log("[webhook-mp] shipment ya existe para order:", orderId);
      return;
    }

    const { data: order } = await supabase
      .from("orders")
      .select("user_id, total, shipping_address, profiles(full_name, email, phone)")
      .eq("id", orderId)
      .single();
    if (!order) {
      console.warn("[webhook-mp] order no encontrada al crear shipment:", orderId);
      return;
    }

    const pkg = calcPackage(items);
    const desc = items
      .map((it) => `${it.quantity}x ${it.description ?? it.products?.name ?? "producto"}`)
      .join(" + ")
      .slice(0, 240);

    const contactEmail =
      (order.shipping_address as any)?.email ??
      (order.profiles as any)?.email ??
      null;
    const contactPhone =
      (order.shipping_address as any)?.phone ??
      (order.profiles as any)?.phone ??
      null;
    const contactName =
      (order.shipping_address as any)?.full_name ??
      (order.profiles as any)?.full_name ??
      "";

    const { data: shipment, error: shipErr } = await supabase
      .from("shipments")
      .insert({
        user_id: order.user_id,
        order_id: orderId,
        status: "pending_address",
        carrier: "andreani", // default; el wizard lo cambia
        description: desc || "Pedido Cancerianas",
        weight_grams: pkg.weight_grams,
        length_cm: pkg.length_cm,
        width_cm: pkg.width_cm,
        height_cm: pkg.height_cm,
        declared_value: Number(order.total ?? 0),
        contact_email: contactEmail,
        contact_phone: contactPhone,
      })
      .select("id")
      .single();

    if (shipErr || !shipment) {
      console.error("[webhook-mp] no se pudo crear shipment:", shipErr);
      return;
    }

    const link = `${SITE_URL}/shipment/${shipment.id}`;

    // Mail
    if (contactEmail) {
      const html = shippingLinkHtml(contactName, link);
      const text = shippingLinkText(contactName, link);
      await sendEmail({
        to: contactEmail,
        subject: `📦 Completá el envío de tu pedido en ${BRAND_NAME}`,
        html,
        text,
      });
    }

    // WhatsApp
    if (contactPhone) {
      await sendWhatsApp({
        to: contactPhone,
        body: shippingLinkWhatsApp(contactName, link),
      });
    }

    await supabase
      .from("shipments")
      .update({ link_sent_at: new Date().toISOString() })
      .eq("id", shipment.id);

    console.log("[webhook-mp] shipment creado + link enviado:", shipment.id);
  } catch (e) {
    console.error("[webhook-mp] error en createShipmentAndNotify:", e);
  }
}

interface ItemForPkg {
  quantity: number;
  products?: {
    weight_grams?: number | null;
    length_cm?: number | null;
    width_cm?: number | null;
    height_cm?: number | null;
  } | null;
}

function calcPackage(items: ItemForPkg[]): {
  weight_grams: number;
  length_cm: number;
  width_cm: number;
  height_cm: number;
} {
  const buffer = 10; // 10g extra por unidad para no quedar corto en cotización
  const defaultWeight = 200;
  let totalWeight = 0;
  let maxLen = 0;
  let maxWidth = 0;
  let totalHeight = 0;
  let hasDims = false;

  for (const it of items) {
    const qty = Math.max(1, it.quantity ?? 1);
    const p = it.products ?? {};
    const w = p.weight_grams && p.weight_grams > 0 ? p.weight_grams : defaultWeight;
    totalWeight += w * qty + buffer * qty;
    if (p.length_cm && p.width_cm && p.height_cm) {
      hasDims = true;
      maxLen = Math.max(maxLen, p.length_cm);
      maxWidth = Math.max(maxWidth, p.width_cm);
      totalHeight += p.height_cm * qty;
    }
  }

  return {
    weight_grams: Math.max(500, Math.round(totalWeight)),
    length_cm: hasDims ? Math.max(10, Math.round(maxLen)) : 25,
    width_cm: hasDims ? Math.max(10, Math.round(maxWidth)) : 20,
    height_cm: hasDims ? Math.max(5, Math.round(totalHeight)) : 10,
  };
}

function shippingLinkHtml(name: string, link: string): string {
  const greeting = name ? `Hola ${name.split(" ")[0]}!` : "¡Hola!";
  return `<!doctype html>
<html lang="es"><body style="margin:0;background:#FFF7F9;font-family:-apple-system,BlinkMacSystemFont,sans-serif;color:#3D2A33">
<table width="100%" cellpadding="0" cellspacing="0" style="background:#FFF7F9;padding:32px 16px"><tr><td align="center">
<table width="560" cellpadding="0" cellspacing="0" style="max-width:560px;background:#FFFFFF;border-radius:24px;overflow:hidden;box-shadow:0 6px 24px rgba(255,143,163,.18)">
${LOGO_URL ? `<tr><td align="center" style="padding:32px 32px 0 32px"><img src="${LOGO_URL}" alt="${BRAND_NAME}" height="48" style="height:48px;width:auto"/></td></tr>` : ""}
<tr><td style="padding:24px 32px 0 32px">
<div style="display:inline-block;background:#A8D5A8;color:#FFFFFF;padding:6px 14px;border-radius:999px;font-size:11px;font-weight:800;letter-spacing:1px;text-transform:uppercase">✓ Pago confirmado</div>
<h1 style="font-size:24px;line-height:1.2;margin:14px 0 0 0;color:#3D2A33;font-family:Georgia,serif">${greeting}<br/>Falta un paso para tu pedido 📦</h1>
</td></tr>
<tr><td style="padding:14px 32px 0 32px;color:#5C4853;font-size:15px;line-height:1.55">
Recibimos tu pago. Para terminar, completá la dirección de envío y elegí cómo te lo mandamos.
<br/><br/>
Tenés 3 opciones:
<ul style="margin:8px 0 0 0;padding-left:20px;line-height:1.7">
  <li><strong>Andreani</strong> — más rápido (24-72hs)</li>
  <li><strong>Correo Argentino</strong> — más barato (3-7 días)</li>
  <li><strong>Personalizado</strong> — coordinás conmigo (motoboy, retiro, etc)</li>
</ul>
</td></tr>
<tr><td style="padding:24px 32px;text-align:center">
<a href="${link}" style="display:inline-block;background:linear-gradient(135deg,#E66B85,#FF8FA3);color:#FFFFFF;padding:14px 28px;border-radius:999px;font-weight:700;text-decoration:none;font-size:16px">Completar envío →</a>
</td></tr>
<tr><td style="padding:0 32px 32px 32px;color:#8E7A82;font-size:12px;line-height:1.5;text-align:center">
Tenés 7 días para completar el envío. Si no, te reembolsamos los productos.<br/>
Link directo: <a href="${link}" style="color:#E66B85;word-break:break-all">${link}</a>
</td></tr>
</table>
<div style="color:#8E7A82;font-size:11px;margin-top:16px">${BRAND_NAME}</div>
</td></tr></table>
</body></html>`;
}

function shippingLinkText(name: string, link: string): string {
  const g = name ? `Hola ${name.split(" ")[0]}!` : "¡Hola!";
  return `${g}

Recibimos tu pago ✓. Falta un paso: completá la dirección y elegí cómo te lo mandamos.

Opciones:
- Andreani (rápido)
- Correo Argentino (más barato)
- Envío personalizado (coordinado)

Completar envío: ${link}

Tenés 7 días. Si no completás, te reembolsamos.

— ${BRAND_NAME}`;
}

function shippingLinkWhatsApp(name: string, link: string): string {
  const g = name ? `Hola ${name.split(" ")[0]}!` : "Hola!";
  return `${g} 🌸 Soy de *${BRAND_NAME}*.

Recibimos tu pago ✓ — falta solo un paso 📦

Tocá este link para cargar la dirección y elegir cómo te mando el pedido (Andreani, Correo Argentino o personalizado):

${link}

Tenés 7 días para completarlo, después te reembolsamos automáticamente.`;
}
