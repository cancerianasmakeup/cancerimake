// Notificaciones unificadas: email (Resend) + WhatsApp (Twilio).
// Sigue el patrón de _shared/correo.ts: si no hay credenciales, mock mode.

// ============================================================
// EMAIL — Resend
// ============================================================
// Resend: https://resend.com/docs/api-reference/emails/send-email
// API key: dashboard → API Keys → Create
// Sender domain: dashboard → Domains → Add domain (necesita SPF/DKIM en DNS)

export interface EmailMessage {
  to: string;
  subject: string;
  html: string;
  text?: string;
}

export interface EmailResult {
  ok: boolean;
  id?: string;
  error?: string;
  mock?: boolean;
}

export async function sendEmail(msg: EmailMessage): Promise<EmailResult> {
  const apiKey = Deno.env.get("RESEND_API_KEY") ?? "";
  const fromEmail = Deno.env.get("RESEND_FROM") ?? ""; // ej: "Cancerianas <ofertas@cancerianas.com.ar>"

  if (!apiKey || !fromEmail) {
    console.log(`[mock email] to=${msg.to} subject="${msg.subject}"`);
    return { ok: true, mock: true, id: `mock-${Date.now()}` };
  }

  try {
    const res = await fetch("https://api.resend.com/emails", {
      method: "POST",
      headers: {
        Authorization: `Bearer ${apiKey}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        from: fromEmail,
        to: [msg.to],
        subject: msg.subject,
        html: msg.html,
        text: msg.text,
      }),
    });
    if (!res.ok) {
      const text = await res.text();
      return { ok: false, error: `Resend ${res.status}: ${text}` };
    }
    const data = await res.json();
    return { ok: true, id: data.id };
  } catch (e) {
    return { ok: false, error: (e as Error).message };
  }
}

// ============================================================
// WHATSAPP — Twilio
// ============================================================
// Twilio WhatsApp: https://www.twilio.com/docs/whatsapp/api
// Necesita Twilio Account SID + Auth Token + número WhatsApp aprobado
// (sandbox para testing: número compartido prefijo whatsapp:+14155238886)

export interface WhatsAppMessage {
  to: string; // E.164: +5491155...
  body: string; // máximo 1600 chars; para producción usar templates aprobados
}

export interface WhatsAppResult {
  ok: boolean;
  sid?: string;
  error?: string;
  mock?: boolean;
}

export async function sendWhatsApp(msg: WhatsAppMessage): Promise<WhatsAppResult> {
  const sid = Deno.env.get("TWILIO_ACCOUNT_SID") ?? "";
  const token = Deno.env.get("TWILIO_AUTH_TOKEN") ?? "";
  const from = Deno.env.get("TWILIO_WHATSAPP_FROM") ?? ""; // ej: "whatsapp:+14155238886"

  if (!sid || !token || !from) {
    console.log(`[mock whatsapp] to=${msg.to} body="${msg.body.slice(0, 60)}…"`);
    return { ok: true, mock: true, sid: `mock-${Date.now()}` };
  }

  // Normalizar destino — admite +5491155... o "whatsapp:+5491155..."
  const to = msg.to.startsWith("whatsapp:") ? msg.to : `whatsapp:${msg.to}`;

  try {
    const body = new URLSearchParams({ From: from, To: to, Body: msg.body });
    const auth = btoa(`${sid}:${token}`);
    const res = await fetch(
      `https://api.twilio.com/2010-04-01/Accounts/${sid}/Messages.json`,
      {
        method: "POST",
        headers: {
          Authorization: `Basic ${auth}`,
          "Content-Type": "application/x-www-form-urlencoded",
        },
        body: body.toString(),
      }
    );
    if (!res.ok) {
      const text = await res.text();
      return { ok: false, error: `Twilio ${res.status}: ${text}` };
    }
    const data = await res.json();
    return { ok: true, sid: data.sid };
  } catch (e) {
    return { ok: false, error: (e as Error).message };
  }
}

// ============================================================
// Helpers de templates para drops
// ============================================================
export interface DropEmailVars {
  brandName: string;
  dropLabel: string;
  startsAt: string; // legible
  endsAt?: string;
  shopUrl: string;
  unsubscribeUrl?: string;
  logoUrl?: string;
}

export function dropOpenEmailHtml(v: DropEmailVars): string {
  return `<!doctype html>
<html lang="es">
<body style="margin:0;background:#FFF7F9;font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',Roboto,sans-serif;color:#3D2A33">
  <table width="100%" cellpadding="0" cellspacing="0" style="background:#FFF7F9;padding:32px 16px">
    <tr><td align="center">
      <table width="560" cellpadding="0" cellspacing="0" style="max-width:560px;background:#FFFFFF;border-radius:24px;overflow:hidden;box-shadow:0 6px 24px rgba(255,143,163,.18)">
        ${
          v.logoUrl
            ? `<tr><td align="center" style="padding:32px 32px 0 32px"><img src="${v.logoUrl}" alt="${v.brandName}" height="48" style="height:48px;width:auto;display:block"/></td></tr>`
            : ""
        }
        <tr><td style="padding:24px 32px 8px 32px;text-align:center">
          <div style="display:inline-block;background:#FFE5EC;color:#E66B85;padding:6px 14px;border-radius:999px;font-size:12px;font-weight:800;letter-spacing:1px;text-transform:uppercase">⚡ Drop ABIERTO</div>
        </td></tr>
        <tr><td style="padding:8px 32px 0 32px;text-align:center">
          <h1 style="font-size:28px;line-height:1.15;margin:8px 0 0 0;color:#3D2A33;font-family:Georgia,serif">${v.dropLabel}</h1>
        </td></tr>
        <tr><td style="padding:16px 32px 0 32px;text-align:center;color:#5C4853;font-size:15px;line-height:1.55">
          La tienda de oportunidades está abierta. Aprovechá las ofertas exclusivas antes de que cierre${v.endsAt ? ` (${v.endsAt})` : ""}.
        </td></tr>
        <tr><td style="padding:24px 32px;text-align:center">
          <a href="${v.shopUrl}" style="display:inline-block;background:linear-gradient(135deg,#E66B85,#FF8FA3);color:#FFFFFF;padding:14px 28px;border-radius:999px;font-weight:700;text-decoration:none;font-size:16px">Entrar a la tienda →</a>
        </td></tr>
        <tr><td style="padding:0 32px 32px 32px;text-align:center;color:#8E7A82;font-size:12px;line-height:1.5">
          Recibís este mail porque te anotaste para que te avisemos del próximo drop.${
            v.unsubscribeUrl
              ? ` Si ya no querés recibirlos, <a href="${v.unsubscribeUrl}" style="color:#8E7A82">desuscribite acá</a>.`
              : ""
          }
        </td></tr>
      </table>
      <div style="color:#8E7A82;font-size:11px;margin-top:16px">${v.brandName}</div>
    </td></tr>
  </table>
</body>
</html>`;
}

export function dropOpenEmailText(v: DropEmailVars): string {
  return `⚡ Drop ABIERTO — ${v.dropLabel}

La tienda de oportunidades está abierta. Aprovechá las ofertas antes de que cierre${
    v.endsAt ? ` (${v.endsAt})` : ""
  }.

Entrar: ${v.shopUrl}

— ${v.brandName}`;
}

export function dropOpenWhatsAppText(v: DropEmailVars): string {
  return `🌸 *${v.brandName}* — ¡abrió el drop!

⚡ *${v.dropLabel}*
${v.endsAt ? `Cierra: ${v.endsAt}\n` : ""}
Entrá: ${v.shopUrl}

(Recibís este mensaje porque te anotaste al próximo drop.)`;
}
