// Edge Function: notify-custom-quote
// Cuando admin pone el precio de un envío personalizado, esta función avisa
// al cliente por email + WhatsApp para que vuelva al wizard a pagar.
//
// Invocación: POST { shipmentId } con un JWT de admin.

import "jsr:@supabase/functions-js/edge-runtime.d.ts";
import { corsHeaders, getSupabaseAdmin, jsonResponse } from "../_shared/utils.ts";
import { sendEmail, sendWhatsApp } from "../_shared/notify.ts";

const SITE_URL = Deno.env.get("SITE_URL") ?? "https://cancerianas.com.ar";
const BRAND_NAME = Deno.env.get("BRAND_NAME") ?? "Cancerianas";
const LOGO_URL = Deno.env.get("BRAND_LOGO_URL") ?? "";

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response(null, { headers: corsHeaders });

  try {
    const body = await req.json().catch(() => ({}));
    if (!body.shipmentId) return jsonResponse({ error: "shipmentId requerido" }, 400);

    const supabase = getSupabaseAdmin();
    const { data: shipment, error } = await supabase
      .from("shipments")
      .select(
        "id, custom_quote_amount, custom_quote_message, contact_email, contact_phone, profiles(full_name, email, phone)"
      )
      .eq("id", body.shipmentId)
      .maybeSingle();
    if (error) throw error;
    if (!shipment) return jsonResponse({ error: "Shipment no encontrado" }, 404);
    if (!shipment.custom_quote_amount) {
      return jsonResponse({ error: "El shipment no tiene cotización personalizada cargada" }, 400);
    }

    const profile = (shipment.profiles ?? null) as any;
    const email = shipment.contact_email ?? profile?.email ?? null;
    const phone = shipment.contact_phone ?? profile?.phone ?? null;
    const name = profile?.full_name ?? "";
    const link = `${SITE_URL}/shipment/${shipment.id}`;
    const amountFormatted = `$${Number(shipment.custom_quote_amount).toLocaleString("es-AR")}`;

    if (!email && !phone) {
      return jsonResponse({ error: "El shipment no tiene mail ni WhatsApp para notificar" }, 400);
    }

    let sentEmail = false;
    let sentWhatsApp = false;

    if (email) {
      const html = customQuoteEmailHtml({
        name,
        amount: amountFormatted,
        message: shipment.custom_quote_message ?? "",
        link,
      });
      const text = customQuoteEmailText({
        name,
        amount: amountFormatted,
        message: shipment.custom_quote_message ?? "",
        link,
      });
      const r = await sendEmail({
        to: email,
        subject: `🤝 Tu cotización de envío: ${amountFormatted}`,
        html,
        text,
      });
      sentEmail = r.ok;
    }

    if (phone) {
      const r = await sendWhatsApp({
        to: phone,
        body: customQuoteWhatsApp({
          name,
          amount: amountFormatted,
          message: shipment.custom_quote_message ?? "",
          link,
        }),
      });
      sentWhatsApp = r.ok;
    }

    return jsonResponse({ ok: true, sentEmail, sentWhatsApp });
  } catch (e) {
    console.error("notify-custom-quote error:", e);
    return jsonResponse({ error: (e as Error).message }, 500);
  }
});

interface Vars {
  name: string;
  amount: string;
  message: string;
  link: string;
}

function customQuoteEmailHtml(v: Vars): string {
  const greet = v.name ? `Hola ${v.name.split(" ")[0]}!` : "¡Hola!";
  return `<!doctype html>
<html lang="es"><body style="margin:0;background:#FFF7F9;font-family:-apple-system,BlinkMacSystemFont,sans-serif;color:#3D2A33">
<table width="100%" cellpadding="0" cellspacing="0" style="background:#FFF7F9;padding:32px 16px"><tr><td align="center">
<table width="560" cellpadding="0" cellspacing="0" style="max-width:560px;background:#FFFFFF;border-radius:24px;overflow:hidden;box-shadow:0 6px 24px rgba(255,143,163,.18)">
${LOGO_URL ? `<tr><td align="center" style="padding:32px 32px 0 32px"><img src="${LOGO_URL}" alt="${BRAND_NAME}" height="48" style="height:48px;width:auto"/></td></tr>` : ""}
<tr><td style="padding:24px 32px 0 32px">
<div style="display:inline-block;background:#E66B85;color:#FFFFFF;padding:6px 14px;border-radius:999px;font-size:11px;font-weight:800;letter-spacing:1px;text-transform:uppercase">🤝 Cotización lista</div>
<h1 style="font-size:24px;line-height:1.2;margin:14px 0 0 0;color:#3D2A33;font-family:Georgia,serif">${greet}<br/>Listo el precio de tu envío</h1>
</td></tr>
<tr><td style="padding:14px 32px 8px 32px;color:#5C4853;font-size:15px;line-height:1.55">
Coordinamos el envío personalizado y te quedó:
</td></tr>
<tr><td align="center" style="padding:0 32px">
<div style="display:inline-block;background:#FFE5EC;border-radius:20px;padding:18px 36px">
<div style="font-family:Georgia,serif;font-size:36px;font-weight:bold;color:#E66B85;line-height:1">${v.amount}</div>
</div>
</td></tr>
${
  v.message
    ? `<tr><td style="padding:18px 32px 0 32px"><div style="background:#FFF7F9;border-left:3px solid #E66B85;padding:12px 16px;border-radius:8px;color:#5C4853;font-size:14px;font-style:italic">${escapeHtml(v.message)}</div></td></tr>`
    : ""
}
<tr><td style="padding:24px 32px;text-align:center">
<a href="${v.link}" style="display:inline-block;background:linear-gradient(135deg,#E66B85,#FF8FA3);color:#FFFFFF;padding:14px 28px;border-radius:999px;font-weight:700;text-decoration:none;font-size:16px">Pagar y completar →</a>
</td></tr>
<tr><td style="padding:0 32px 32px 32px;color:#8E7A82;font-size:12px;line-height:1.5;text-align:center">
Link directo: <a href="${v.link}" style="color:#E66B85;word-break:break-all">${v.link}</a>
</td></tr>
</table>
<div style="color:#8E7A82;font-size:11px;margin-top:16px">${BRAND_NAME}</div>
</td></tr></table>
</body></html>`;
}

function customQuoteEmailText(v: Vars): string {
  const g = v.name ? `Hola ${v.name.split(" ")[0]}!` : "¡Hola!";
  return `${g}

Listo el precio de tu envío personalizado: ${v.amount}.
${v.message ? `\n"${v.message}"\n` : ""}
Pagar y completar: ${v.link}

— ${BRAND_NAME}`;
}

function customQuoteWhatsApp(v: Vars): string {
  const g = v.name ? `Hola ${v.name.split(" ")[0]}!` : "Hola!";
  return `${g} 🌸

Te paso la cotización del envío personalizado:

💰 *${v.amount}*
${v.message ? `\n_"${v.message}"_\n` : ""}
Para pagar y confirmar:
${v.link}

— ${BRAND_NAME}`;
}

function escapeHtml(s: string): string {
  return s
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;");
}
