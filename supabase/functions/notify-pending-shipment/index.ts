// Edge Function: notify-pending-shipment
// Manda recordatorios a clientas que pagaron productos pero no completaron el envío.
//
// Modos de invocación:
//   1) Cron sin body → busca todos los shipments pendientes que toca recordar
//   2) Manual con { shipmentId } → fuerza un recordatorio específico (admin)
//
// Reglas:
//   · 1er recordatorio: link_sent_at hace ≥ 24h
//   · 2do recordatorio: link_sent_at hace ≥ 72h
//   · Después del 2do, no se mandan más recordatorios automáticos
//   · last_reminder_at debe ser >24h atrás (no spamear si el cron corre seguido)
//   · El producto queda reservado: NO hay reembolso automático.

import "jsr:@supabase/functions-js/edge-runtime.d.ts";
import { corsHeaders, getSupabaseAdmin, jsonResponse } from "../_shared/utils.ts";
import { sendEmail, sendWhatsApp } from "../_shared/notify.ts";

const SITE_URL = Deno.env.get("SITE_URL") ?? "https://cancerianas.com.ar";
const BRAND_NAME = Deno.env.get("BRAND_NAME") ?? "Cancerianas";
const LOGO_URL = Deno.env.get("BRAND_LOGO_URL") ?? "";
const TIKTOK_URL = Deno.env.get("BRAND_TIKTOK_URL") ?? "";

const HOUR = 60 * 60 * 1000;
const FIRST_REMINDER_AFTER = 24 * HOUR;
const SECOND_REMINDER_AFTER = 72 * HOUR;
const MIN_HOURS_BETWEEN = 24 * HOUR; // no enviar si último recordatorio fue hace <24h

interface PendingShipment {
  id: string;
  status: string;
  reminder_count: number;
  last_reminder_at: string | null;
  link_sent_at: string | null;
  custom_quoted_at: string | null;
  custom_quote_amount: number | null;
  contact_email: string | null;
  contact_phone: string | null;
  description: string;
  profiles?: { full_name: string | null; email: string | null; phone: string | null };
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response(null, { headers: corsHeaders });

  try {
    const body = req.method === "POST" ? await safeJson(req) : {};
    const supabase = getSupabaseAdmin();
    const now = Date.now();

    let candidates: PendingShipment[];

    if (body.shipmentId) {
      // Modo manual: forzar recordatorio para un shipment específico
      const { data, error } = await supabase
        .from("shipments")
        .select(
          "id, status, reminder_count, last_reminder_at, link_sent_at, custom_quoted_at, custom_quote_amount, contact_email, contact_phone, description, profiles!user_id(full_name, email, phone)"
        )
        .eq("id", body.shipmentId)
        .maybeSingle();
      if (error) throw error;
      if (!data) return jsonResponse({ error: "Shipment no encontrado" }, 404);
      candidates = [data as PendingShipment];
    } else {
      // Modo cron: buscar todos los pendientes que toca recordar
      const { data, error } = await supabase
        .from("shipments")
        .select(
          "id, status, reminder_count, last_reminder_at, link_sent_at, custom_quoted_at, custom_quote_amount, contact_email, contact_phone, description, profiles!user_id(full_name, email, phone)"
        )
        .in("status", ["pending_address", "pending_custom_quote", "pending_payment"])
        .lt("reminder_count", 2)
        .returns<PendingShipment[]>();
      if (error) throw error;
      candidates = data ?? [];
    }

    let sent = 0;
    let skipped = 0;
    let errors = 0;

    for (const s of candidates) {
      const decision = decideReminder(s, now);
      if (!decision.send && !body.shipmentId) {
        skipped++;
        continue;
      }
      // En modo manual, ignoramos el cooldown pero respetamos el max=2
      if (body.shipmentId && s.reminder_count >= 2) {
        skipped++;
        continue;
      }

      const tier = decision.send ? decision.tier : (s.reminder_count + 1) as 1 | 2;
      const r = await sendReminder(s, tier);
      if (r.ok) {
        sent++;
        await supabase
          .from("shipments")
          .update({
            reminder_count: s.reminder_count + 1,
            last_reminder_at: new Date().toISOString(),
          })
          .eq("id", s.id);
      } else {
        errors++;
      }
    }

    return jsonResponse({
      ok: true,
      candidates: candidates.length,
      sent,
      skipped,
      errors,
    });
  } catch (e) {
    console.error("notify-pending-shipment error:", e);
    return jsonResponse({ error: (e as Error).message }, 500);
  }
});

interface ReminderDecision {
  send: boolean;
  tier: 1 | 2;
  reason: string;
}

function decideReminder(s: PendingShipment, now: number): ReminderDecision {
  // Anchor: el más reciente entre link_sent_at y custom_quoted_at
  // (el "reloj" del recordatorio se resetea cuando admin pone precio custom)
  const anchor = pickAnchor(s);
  if (!anchor) return { send: false, tier: 1, reason: "no_anchor" };

  const ageMs = now - anchor;
  const lastReminder = s.last_reminder_at ? new Date(s.last_reminder_at).getTime() : 0;
  const sinceLast = now - lastReminder;

  // Spam guard
  if (lastReminder > 0 && sinceLast < MIN_HOURS_BETWEEN) {
    return { send: false, tier: 1, reason: "too_recent" };
  }

  // Tier 1: 24h y aún no se mandó ninguno
  if (s.reminder_count === 0 && ageMs >= FIRST_REMINDER_AFTER) {
    return { send: true, tier: 1, reason: "tier1_24h" };
  }
  // Tier 2: 72h y ya se mandó el primero
  if (s.reminder_count === 1 && ageMs >= SECOND_REMINDER_AFTER) {
    return { send: true, tier: 2, reason: "tier2_72h" };
  }
  return { send: false, tier: 1, reason: "not_due_yet" };
}

function pickAnchor(s: PendingShipment): number | null {
  const linkMs = s.link_sent_at ? new Date(s.link_sent_at).getTime() : null;
  const customMs = s.custom_quoted_at ? new Date(s.custom_quoted_at).getTime() : null;
  if (linkMs && customMs) return Math.max(linkMs, customMs);
  return linkMs ?? customMs;
}

async function sendReminder(
  s: PendingShipment,
  tier: 1 | 2
): Promise<{ ok: boolean }> {
  const profile = s.profiles ?? null;
  const email = s.contact_email ?? profile?.email ?? null;
  const phone = s.contact_phone ?? profile?.phone ?? null;
  const name = profile?.full_name ?? "";

  if (!email && !phone) {
    console.warn(`[reminder] shipment ${s.id} no tiene mail ni phone`);
    return { ok: false };
  }

  const link = `${SITE_URL}/shipment/${s.id}`;
  const isCustom = s.status === "pending_payment" && s.custom_quote_amount != null;
  const isPendingCustom = s.status === "pending_custom_quote";

  let subject: string;
  let html: string;
  let text: string;
  let wa: string;

  if (isCustom) {
    // Envío personalizado: ya hay precio acordado, falta pagar
    const amount = `$${Number(s.custom_quote_amount).toLocaleString("es-AR")}`;
    subject =
      tier === 1
        ? `🤝 Tu envío personalizado quedó pendiente de pago (${amount})`
        : `⏰ Último aviso · pagá tu envío personalizado para que despachemos`;
    html = customReminderHtml(name, link, amount, tier);
    text = customReminderText(name, link, amount, tier);
    wa = customReminderWa(name, link, amount, tier);
  } else if (isPendingCustom) {
    // Pidió personalizado pero todavía no le cargué precio → es problema mío, no de la clienta
    // Le mando un mensaje suave avisándole que estamos en eso
    subject =
      tier === 1
        ? `🤝 Estamos coordinando tu envío personalizado`
        : `🤝 Recordatorio: tu envío personalizado está en proceso`;
    html = waitingCustomReminderHtml(name, link, tier);
    text = waitingCustomReminderText(name, link, tier);
    wa = waitingCustomReminderWa(name, link, tier);
  } else {
    // pending_address o pending_payment con cotización Andreani/Correo
    subject =
      tier === 1
        ? `📦 Falta un paso para completar tu pedido en ${BRAND_NAME}`
        : `⏰ Último recordatorio · completá tu envío para que despachemos`;
    html = standardReminderHtml(name, link, tier);
    text = standardReminderText(name, link, tier);
    wa = standardReminderWa(name, link, tier);
  }

  let anyOk = false;
  if (email) {
    const r = await sendEmail({ to: email, subject, html, text });
    if (r.ok) anyOk = true;
  }
  if (phone) {
    const r = await sendWhatsApp({ to: phone, body: wa });
    if (r.ok) anyOk = true;
  }
  return { ok: anyOk };
}

async function safeJson(req: Request): Promise<any> {
  try {
    return await req.json();
  } catch {
    return {};
  }
}

// ============================================================
// Templates
// ============================================================
function shellHtml(title: string, badgeText: string, badgeColor: string, body: string, link: string): string {
  return `<!doctype html>
<html lang="es"><body style="margin:0;background:#FFF7F9;font-family:-apple-system,BlinkMacSystemFont,sans-serif;color:#3D2A33">
<table width="100%" cellpadding="0" cellspacing="0" style="background:#FFF7F9;padding:32px 16px"><tr><td align="center">
<table width="560" cellpadding="0" cellspacing="0" style="max-width:560px;background:#FFFFFF;border-radius:24px;overflow:hidden;box-shadow:0 6px 24px rgba(255,143,163,.18)">
${LOGO_URL ? `<tr><td align="center" style="padding:32px 32px 0 32px"><img src="${LOGO_URL}" alt="${BRAND_NAME}" height="48" style="height:48px;width:auto"/></td></tr>` : ""}
<tr><td style="padding:24px 32px 0 32px">
<div style="display:inline-block;background:${badgeColor};color:#FFFFFF;padding:6px 14px;border-radius:999px;font-size:11px;font-weight:800;letter-spacing:1px;text-transform:uppercase">${badgeText}</div>
<h1 style="font-size:24px;line-height:1.2;margin:14px 0 0 0;color:#3D2A33;font-family:Georgia,serif">${title}</h1>
</td></tr>
<tr><td style="padding:14px 32px 0 32px;color:#5C4853;font-size:15px;line-height:1.55">
${body}
</td></tr>
<tr><td style="padding:24px 32px;text-align:center">
<a href="${link}" style="display:inline-block;background:linear-gradient(135deg,#E66B85,#FF8FA3);color:#FFFFFF;padding:14px 28px;border-radius:999px;font-weight:700;text-decoration:none;font-size:16px">Continuar →</a>
</td></tr>
<tr><td style="padding:0 32px 32px 32px;color:#8E7A82;font-size:12px;line-height:1.5;text-align:center">
Tu producto está reservado a tu nombre — no caduca.<br/>
Link directo: <a href="${link}" style="color:#E66B85;word-break:break-all">${link}</a>
</td></tr>
</table>
<div style="color:#8E7A82;font-size:11px;margin-top:16px">${BRAND_NAME}</div>
</td></tr></table>
</body></html>`;
}

// --- Estándar (Andreani/Correo cotizado o pendiente de address)
function standardReminderHtml(name: string, link: string, tier: 1 | 2): string {
  const greeting = name ? `Hola ${name.split(" ")[0]}!` : "¡Hola!";
  const title = tier === 1 ? `${greeting}<br/>Falta completar tu envío 📦` : `${greeting}<br/>Tu pedido te espera 🌸`;
  const badge = tier === 1 ? "Recordatorio" : "Último recordatorio";
  const color = tier === 1 ? "#FF8FA3" : "#E66B85";
  const intro =
    tier === 1
      ? `Vimos que pagaste tus productos pero todavía no cargaste la dirección de envío. Cuando puedas, completalo en este link.`
      : `Ya pasaron 3 días y tu envío sigue pendiente. Para poder despachar tu pedido necesitamos que completes la dirección y elijas el carrier (Andreani, Correo o personalizado).`;
  return shellHtml(title, badge, color, `${intro}<br/><br/><strong>Tu producto está reservado.</strong> No se cancela ni se reembolsa: queda esperando que completes el envío.`, link);
}
function standardReminderText(name: string, link: string, tier: 1 | 2): string {
  const g = name ? `Hola ${name.split(" ")[0]}!` : "¡Hola!";
  const intro =
    tier === 1
      ? `Vimos que pagaste tus productos pero todavía no cargaste la dirección de envío.`
      : `Ya pasaron 3 días y tu envío sigue pendiente.`;
  return `${g}\n\n${intro}\n\nTu producto está reservado a tu nombre. Cuando puedas:\n${link}\n\n— ${BRAND_NAME}`;
}
function standardReminderWa(name: string, link: string, tier: 1 | 2): string {
  const g = name ? `Hola ${name.split(" ")[0]}!` : "Hola!";
  if (tier === 1)
    return `${g} 🌸\n\nTe escribo de *${BRAND_NAME}*. Pagaste tus productos ✓ pero falta cargar la dirección de envío.\n\nTu producto está reservado a tu nombre — cuando puedas:\n\n${link}`;
  return `${g} 🌸\n\nÚltimo recordatorio amistoso de *${BRAND_NAME}*. Tu pedido sigue pendiente de envío.\n\nTu producto está esperándote, no se reembolsa. Cualquier duda escribime por acá:\n\n${link}`;
}

// --- Custom: ya hay precio, falta pagar
function customReminderHtml(name: string, link: string, amount: string, tier: 1 | 2): string {
  const greeting = name ? `Hola ${name.split(" ")[0]}!` : "¡Hola!";
  const title = tier === 1 ? `${greeting}<br/>Tu envío personalizado quedó pendiente 🤝` : `${greeting}<br/>Tu envío personalizado te espera`;
  const badge = tier === 1 ? "Recordatorio" : "Último recordatorio";
  const color = tier === 1 ? "#FF8FA3" : "#E66B85";
  const intro = `Ya cotizamos tu envío personalizado en <strong>${amount}</strong>. ${
    tier === 1
      ? "Cuando puedas, pagalo desde el link y te lo despachamos."
      : "Han pasado 3 días desde la cotización. Apenas pagues, despachamos."
  }`;
  return shellHtml(title, badge, color, `${intro}<br/><br/><strong>Tu producto está reservado.</strong> No se cancela: queda esperándote.`, link);
}
function customReminderText(name: string, link: string, amount: string, tier: 1 | 2): string {
  const g = name ? `Hola ${name.split(" ")[0]}!` : "¡Hola!";
  const intro = tier === 1
    ? `Ya cotizamos tu envío personalizado en ${amount}. Cuando puedas, pagalo en:`
    : `Recordatorio: tu envío personalizado de ${amount} sigue pendiente de pago.`;
  return `${g}\n\n${intro}\n${link}\n\nTu producto está reservado.\n— ${BRAND_NAME}`;
}
function customReminderWa(name: string, link: string, amount: string, tier: 1 | 2): string {
  const g = name ? `Hola ${name.split(" ")[0]}!` : "Hola!";
  return `${g} 🌸\n\n${tier === 1 ? "Te paso un recordatorio amistoso" : "Último recordatorio"} 🤝\n\nTu envío personalizado quedó cotizado en *${amount}* y todavía está pendiente de pago.\n\nTu producto está reservado, esperando:\n${link}`;
}

// --- Pending custom quote: clienta espera mi cotización
function waitingCustomReminderHtml(name: string, link: string, tier: 1 | 2): string {
  const greeting = name ? `Hola ${name.split(" ")[0]}!` : "¡Hola!";
  const title = `${greeting}<br/>Estoy coordinando tu envío 🤝`;
  const intro =
    tier === 1
      ? `Te escribo para confirmarte que estoy preparando la cotización personalizada de tu envío. Si todavía no me escribiste por WhatsApp, podemos coordinarlo desde acá.`
      : `Quería pasarte por acá: sigo trabajando en la cotización personalizada de tu envío. Si querés acelerarlo, escribime por WhatsApp${TIKTOK_URL ? ` o por TikTok (${TIKTOK_URL})` : ""}.`;
  return shellHtml(title, "Estamos en eso", "#FF8FA3", `${intro}<br/><br/>Tu pedido está reservado, sin cargo extra.`, link);
}
function waitingCustomReminderText(name: string, link: string, _tier: 1 | 2): string {
  const g = name ? `Hola ${name.split(" ")[0]}!` : "¡Hola!";
  return `${g}\n\nEstoy coordinando tu envío personalizado. Cualquier consulta, escribime por WhatsApp.\n\nLink: ${link}\n— ${BRAND_NAME}`;
}
function waitingCustomReminderWa(name: string, link: string, _tier: 1 | 2): string {
  const g = name ? `Hola ${name.split(" ")[0]}!` : "Hola!";
  return `${g} 🌸\n\nTe paso por acá para confirmarte que sigo coordinando tu envío personalizado. Si querés, charlamos por acá los detalles.\n\n${link}`;
}
