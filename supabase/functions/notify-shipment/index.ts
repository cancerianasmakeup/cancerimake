// Edge Function: notify-shipment
// Manda el link del envío a la clienta por email (Resend) o devuelve los datos
// para que el front abra WhatsApp.
//
// Body:
//   { shipment_id: string, channel: 'email' | 'whatsapp_url' }
//
// Si channel='email' y RESEND_API_KEY está seteado → envía email vía Resend.
// Si channel='whatsapp_url' → devuelve { url } para que el front haga window.open.
//
// Secrets:
//   RESEND_API_KEY=re_...
//   RESEND_FROM=Cancerianas <envios@cancerianas.com>
//   SITE_URL=https://cancerianas.app

import "jsr:@supabase/functions-js/edge-runtime.d.ts";
import {
  corsHeaders,
  jsonResponse,
  getSupabaseAdmin,
  getSupabaseFromRequest,
} from "../_shared/utils.ts";

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response(null, { headers: corsHeaders });

  try {
    const body = await req.json().catch(() => ({}));
    const { shipment_id, channel = "email" } = body;
    if (!shipment_id) return jsonResponse({ error: "shipment_id requerido" }, 400);

    // Auth: admin only
    const userClient = getSupabaseFromRequest(req);
    const { data: { user } } = await userClient.auth.getUser();
    if (!user) return jsonResponse({ error: "no auth" }, 401);

    const supabase = getSupabaseAdmin();
    const { data: profile } = await supabase
      .from("profiles")
      .select("role")
      .eq("id", user.id)
      .single();
    if (profile?.role !== "admin") return jsonResponse({ error: "admin only" }, 403);

    // Cargar shipment + clienta
    const { data: shipment } = await supabase
      .from("shipments")
      .select("id, status, description, profiles!user_id(full_name, email, phone)")
      .eq("id", shipment_id)
      .single();
    if (!shipment) return jsonResponse({ error: "envío no encontrado" }, 404);

    const profileRow = (shipment as any).profiles ?? {};
    const siteUrl = Deno.env.get("SITE_URL") ?? "https://cancerianas.app";
    const link = `${siteUrl}/shipment/${shipment_id}`;
    const firstName = (profileRow.full_name ?? "").split(" ")[0] || "Hola";

    if (channel === "whatsapp_url") {
      const phone = (profileRow.phone ?? "").replace(/\D/g, "");
      const msg = encodeURIComponent(
        `${firstName}! 🌸 Te dejo el link para que cargues tu dirección y completes el envío de Cancerianas:\n\n${link}\n\nElegís correo (Andreani o Correo Argentino), domicilio o sucursal y pagás. Cualquier duda me decís 💗`
      );
      const url = phone
        ? `https://wa.me/${phone.startsWith("54") ? phone : "54" + phone}?text=${msg}`
        : `https://wa.me/?text=${msg}`;
      return jsonResponse({ ok: true, url });
    }

    // Channel = email
    const apiKey = Deno.env.get("RESEND_API_KEY");
    if (!apiKey) {
      return jsonResponse({
        ok: true,
        skipped: "RESEND_API_KEY no configurado · usá WhatsApp o copiá el link",
      });
    }
    const from = Deno.env.get("RESEND_FROM") ?? "Cancerianas <envios@cancerianas.app>";

    const html = `
      <div style="font-family:system-ui,sans-serif;max-width:560px;margin:0 auto;padding:24px;background:#fff5f7">
        <div style="text-align:center;margin-bottom:24px">
          <h1 style="font-family:Georgia,serif;color:#c2185b;font-size:32px;margin:0">🌸 Cancerianas</h1>
        </div>
        <div style="background:#fff;border-radius:24px;padding:32px;box-shadow:0 4px 24px rgba(194,24,91,.08)">
          <h2 style="color:#1a1a2e;margin:0 0 16px">¡${firstName}!</h2>
          <p style="color:#4a4a5e;line-height:1.6">
            Te preparamos un envío con tu mercadería 📦. Para que te llegue, necesitás cargar
            tu dirección y pagar el flete.
          </p>
          <div style="background:#fff5f7;border-radius:16px;padding:16px;margin:16px 0">
            <p style="margin:0;color:#1a1a2e;font-weight:600;font-size:14px">📦 Contenido</p>
            <p style="margin:4px 0 0;color:#4a4a5e">${shipment.description}</p>
          </div>
          <p style="color:#4a4a5e;line-height:1.6;font-size:14px">
            Vas a poder elegir entre <strong>Andreani</strong> o <strong>Correo Argentino</strong>,
            envío a domicilio o retiro en sucursal.
          </p>
          <div style="text-align:center;margin:32px 0">
            <a href="${link}" style="display:inline-block;background:#c2185b;color:#fff;text-decoration:none;padding:14px 32px;border-radius:32px;font-weight:600">
              Completar mi envío →
            </a>
          </div>
          <p style="color:#9a9aae;font-size:12px;text-align:center;margin:24px 0 0">
            Si el botón no funciona, copiá y pegá este link:<br>
            <a href="${link}" style="color:#c2185b">${link}</a>
          </p>
        </div>
        <p style="color:#9a9aae;font-size:11px;text-align:center;margin-top:16px">
          Cancerianas · Argentina · cancerianas.kids@gmail.com
        </p>
      </div>
    `;

    const res = await fetch("https://api.resend.com/emails", {
      method: "POST",
      headers: {
        Authorization: `Bearer ${apiKey}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        from,
        to: profileRow.email,
        subject: `🌸 ${firstName}, completá tu envío de Cancerianas`,
        html,
      }),
    });
    if (!res.ok) {
      const text = await res.text();
      console.error("Resend error:", text);
      return jsonResponse({ error: `Resend ${res.status}: ${text}` }, 500);
    }

    const result = await res.json();
    return jsonResponse({ ok: true, email_id: result.id });
  } catch (e) {
    console.error("notify-shipment error:", e);
    return jsonResponse({ error: (e as Error).message }, 500);
  }
});
