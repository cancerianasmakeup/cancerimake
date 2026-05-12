// Edge Function: notify-drop-open
// Notifica a las suscriptas (store_subscribers) cuando un drop abre.
//
// Modos de invocación:
//   1) Manual desde admin: POST { dropId } con un JWT de admin
//   2) Automático por cron: POST sin body (usa service role secret en Authorization)
//      → busca drops cuyo starts_at esté en los próximos N minutos y aún no notificados
//
// Idempotencia: cada subscriber tiene `notified_drops UUID[]`. Antes de enviar,
// se filtran subs que ya recibieron aviso de ese drop.
//
// Modo MOCK: si no hay RESEND_API_KEY ni TWILIO_*, se loguea pero no se envía.
// En todos los modos, marcamos a los suscriptores como notificados.

import "jsr:@supabase/functions-js/edge-runtime.d.ts";
import { corsHeaders, getSupabaseAdmin, jsonResponse } from "../_shared/utils.ts";
import {
  sendEmail,
  sendWhatsApp,
  dropOpenEmailHtml,
  dropOpenEmailText,
  dropOpenWhatsAppText,
} from "../_shared/notify.ts";

interface Drop {
  id: string;
  starts_at: string;
  ends_at: string;
  label?: string;
}

interface StoreStatus {
  drops?: Drop[];
}

interface Subscriber {
  id: string;
  email: string | null;
  phone: string | null;
  notified_drops: string[] | null;
}

const SITE_URL = Deno.env.get("SITE_URL") ?? "https://cancerianas.com.ar";
const BRAND_NAME = Deno.env.get("BRAND_NAME") ?? "Cancerianas";
const LOGO_URL = Deno.env.get("BRAND_LOGO_URL") ?? "";
// Cuántos minutos antes/después del start_at consideramos al drop "recién abierto"
const WINDOW_MIN = Number(Deno.env.get("NOTIFY_WINDOW_MINUTES") ?? "10");

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response(null, { headers: corsHeaders });

  try {
    const body = req.method === "POST" ? await safeJson(req) : {};
    const supabase = getSupabaseAdmin();

    // Cargar config con todos los drops
    const { data: setting, error: settingErr } = await supabase
      .from("site_settings")
      .select("value")
      .eq("key", "store_status")
      .maybeSingle();
    if (settingErr) throw settingErr;
    const config = (setting?.value ?? {}) as StoreStatus;
    const allDrops = config.drops ?? [];

    // ¿qué drop notificamos?
    let targetDrops: Drop[] = [];
    if (body.dropId) {
      const d = allDrops.find((x) => x.id === body.dropId);
      if (!d) return jsonResponse({ error: `dropId ${body.dropId} no existe` }, 404);
      targetDrops = [d];
    } else {
      // Modo cron: buscar drops abriendo en la ventana
      const now = Date.now();
      const winMs = WINDOW_MIN * 60 * 1000;
      targetDrops = allDrops.filter((d) => {
        const s = new Date(d.starts_at).getTime();
        return s >= now - winMs && s <= now + winMs;
      });
    }

    if (targetDrops.length === 0) {
      return jsonResponse({ ok: true, message: "Ningún drop dentro de la ventana", notified: 0 });
    }

    let totalNotified = 0;
    let totalErrors = 0;
    const perDrop: Record<string, { sent: number; errors: number }> = {};

    for (const drop of targetDrops) {
      // Suscriptas que NO recibieron aviso de este drop
      const { data: subs, error: subsErr } = await supabase
        .from("store_subscribers")
        .select("id, email, phone, notified_drops")
        .returns<Subscriber[]>();
      if (subsErr) throw subsErr;

      const pending = (subs ?? []).filter(
        (s) => !(s.notified_drops ?? []).includes(drop.id)
      );

      const startsHuman = new Date(drop.starts_at).toLocaleString("es-AR", {
        weekday: "short",
        day: "numeric",
        month: "short",
        hour: "2-digit",
        minute: "2-digit",
      });
      const endsHuman = new Date(drop.ends_at).toLocaleString("es-AR", {
        weekday: "short",
        day: "numeric",
        month: "short",
        hour: "2-digit",
        minute: "2-digit",
      });
      const tplVars = {
        brandName: BRAND_NAME,
        dropLabel: drop.label || "Drop de oportunidades",
        startsAt: startsHuman,
        endsAt: endsHuman,
        shopUrl: SITE_URL,
        logoUrl: LOGO_URL,
      };
      const html = dropOpenEmailHtml(tplVars);
      const text = dropOpenEmailText(tplVars);
      const wapp = dropOpenWhatsAppText(tplVars);

      let sent = 0;
      let errors = 0;
      for (const sub of pending) {
        let oneOk = false;
        if (sub.email) {
          const r = await sendEmail({
            to: sub.email,
            subject: `⚡ Abrió el drop · ${tplVars.dropLabel}`,
            html,
            text,
          });
          if (r.ok) oneOk = true;
          else errors++;
        }
        if (sub.phone) {
          const r = await sendWhatsApp({ to: sub.phone, body: wapp });
          if (r.ok) oneOk = true;
          else errors++;
        }

        // Marcar como notificado si AL MENOS un canal salió OK (o si fue mock)
        if (oneOk) {
          const updated = [...(sub.notified_drops ?? []), drop.id];
          await supabase
            .from("store_subscribers")
            .update({ notified_drops: updated })
            .eq("id", sub.id);
          sent++;
        }
      }

      perDrop[drop.id] = { sent, errors };
      totalNotified += sent;
      totalErrors += errors;
    }

    return jsonResponse({
      ok: true,
      drops: targetDrops.length,
      notified: totalNotified,
      errors: totalErrors,
      perDrop,
    });
  } catch (e) {
    console.error("notify-drop-open error:", e);
    return jsonResponse({ error: (e as Error).message }, 500);
  }
});

async function safeJson(req: Request): Promise<any> {
  try {
    return await req.json();
  } catch {
    return {};
  }
}
