// Edge Function pública: shipping (URL legacy: andreani)
// Routea entre carriers (Andreani / Correo Argentino) según `shipment.carrier`
// o el campo `carrier` que mande el cliente en el body para `quote`.
//
// Endpoints (vía POST con body { action, ... }):
//   - quote: cotizar envío. Body extra: { carrier?: 'andreani'|'correo_argentino' }
//   - create-shipment: crear orden en el carrier después de pagar
//   - track: poll de tracking
//   - label: descargar PDF (admin only, sólo Andreani)
//
// Modo MOCK por defecto. Secrets:
//   ANDREANI_MODE / ANDREANI_USER / ANDREANI_PASS / ...
//   CORREO_MODE / CORREO_USER_TOKEN / CORREO_PASSWORD_TOKEN / CORREO_EMAIL / CORREO_PASSWORD / CORREO_CUSTOMER_ID

import "jsr:@supabase/functions-js/edge-runtime.d.ts";
import {
  corsHeaders,
  jsonResponse,
  getSupabaseAdmin,
  getSupabaseFromRequest,
} from "../_shared/utils.ts";
import {
  andreaniQuote,
  andreaniCreateOrder,
  andreaniTracking,
  andreaniLabel,
  getAndreaniCreds,
  mapAndreaniStatus,
} from "../_shared/andreani.ts";
import {
  correoQuote,
  correoCreateOrder,
  correoTracking,
  correoAgencies,
  getCorreoCreds,
  mapCorreoStatus,
} from "../_shared/correo.ts";

type Carrier = "andreani" | "correo_argentino";

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response(null, { headers: corsHeaders });

  try {
    const url = new URL(req.url);
    const action = url.searchParams.get("action") ?? (await safeJsonAction(req));
    const body = req.method === "POST" ? await safeJson(req) : {};

    switch (action) {
      case "quote":
        return await handleQuote(body);
      case "agencies":
        return await handleAgencies(body);
      case "create-shipment":
        return await handleCreate(body, req);
      case "track":
        return await handleTrack(body, req);
      case "label":
        return await handleLabel(body, req);
      default:
        return jsonResponse(
          { error: "action requerido: quote | agencies | create-shipment | track | label" },
          400
        );
    }
  } catch (e) {
    console.error("shipping fn error:", e);
    return jsonResponse({ error: (e as Error).message }, 500);
  }
});

async function safeJson(req: Request) {
  try {
    return await req.json();
  } catch {
    return {};
  }
}

async function safeJsonAction(req: Request) {
  if (req.method !== "POST") return null;
  try {
    const body = await req.clone().json();
    return body.action ?? null;
  } catch {
    return null;
  }
}

function pickCarrier(body: any): Carrier {
  const c = (body?.carrier ?? "andreani").toLowerCase();
  return c === "correo_argentino" ? "correo_argentino" : "andreani";
}

// ============================================================
// QUOTE — público (la clienta cotiza desde el wizard)
// ============================================================
async function handleQuote(body: any) {
  const { cpDestino, destinationType, bultos } = body;
  const carrier = pickCarrier(body);
  if (!cpDestino || !destinationType || !Array.isArray(bultos)) {
    return jsonResponse({ error: "Faltan campos: cpDestino, destinationType, bultos" }, 400);
  }

  const supabase = getSupabaseAdmin();
  const { data: setting } = await supabase
    .from("site_settings")
    .select("value")
    .eq("key", "shipping_origin")
    .single();
  const origin = setting?.value ?? {};
  const cpOrigen = origin.codigo_postal ?? "1744";

  const { data: extrasSetting } = await supabase
    .from("site_settings")
    .select("value")
    .eq("key", "shipping_extras")
    .single();
  const extras = extrasSetting?.value ?? {};
  const recargoPct = Number(extras.recargo_porcentaje ?? 0);
  const feeFijo = Number(extras.fee_fijo ?? 0);

  let baseTotal = 0;
  let pesoAforado = "0";
  let raw: unknown = null;
  let mode = "mock";

  if (carrier === "correo_argentino") {
    const creds = getCorreoCreds();
    mode = creds.mode;
    const result = await correoQuote(creds, {
      cpDestino,
      cpOrigen,
      destinationType,
      bultos: bultos.map((b: any) => ({
        kilos: b.kilos,
        largoCm: Math.max(1, Math.round((b.length_cm ?? b.largoCm ?? 25))),
        anchoCm: Math.max(1, Math.round((b.width_cm ?? b.anchoCm ?? 20))),
        altoCm: Math.max(1, Math.round((b.height_cm ?? b.altoCm ?? 10))),
      })),
    });
    baseTotal = result.bestRate.price;
    pesoAforado = bultos.reduce((s: number, b: any) => s + b.kilos, 0).toFixed(2);
    raw = result.raw;
  } else {
    const creds = getAndreaniCreds();
    mode = creds.mode;
    const result = await andreaniQuote(creds, {
      cpDestino,
      sucursalOrigen: cpOrigen,
      destinationType,
      bultos: bultos.map((b: any) => ({
        kilos: b.kilos,
        volumen:
          b.volumen ??
          (((b.length_cm ?? b.largoCm ?? 25) *
            (b.width_cm ?? b.anchoCm ?? 20) *
            (b.height_cm ?? b.altoCm ?? 10)) /
            1000),
        valorDeclarado: b.valorDeclarado ?? 0,
      })),
    });
    baseTotal = parseFloat(result.tarifaConIva.total);
    pesoAforado = result.pesoAforado;
    raw = result.raw;
  }

  const finalTotal = baseTotal * (1 + recargoPct / 100) + feeFijo;

  return jsonResponse({
    carrier,
    cost_quoted: baseTotal,
    cost_charged: Math.round(finalTotal * 100) / 100,
    pesoAforado,
    raw,
    mode,
  });
}

// ============================================================
// AGENCIES — listar sucursales (sólo Correo Argentino acepta region;
// Andreani usa el flujo de mock branches por CP en el front todavía).
// ============================================================
async function handleAgencies(body: any) {
  const carrier = pickCarrier(body);
  const region = body?.region ?? "Buenos Aires";
  if (carrier === "correo_argentino") {
    const creds = getCorreoCreds();
    const branches = await correoAgencies(creds, region);
    return jsonResponse({ carrier, branches, mode: creds.mode });
  }
  // Andreani: por ahora devolvemos vacío para que el frontend use su mock local
  return jsonResponse({ carrier, branches: [], mode: "front-mock" });
}

// ============================================================
// CREATE-SHIPMENT — admin only (después de pago confirmado)
// ============================================================
async function handleCreate(body: any, req: Request) {
  const { shipment_id } = body;
  if (!shipment_id) return jsonResponse({ error: "shipment_id requerido" }, 400);

  const supabase = getSupabaseAdmin();
  const userClient = getSupabaseFromRequest(req);
  const { data: { user } } = await userClient.auth.getUser();
  if (!user) return jsonResponse({ error: "no auth" }, 401);

  const { data: profile } = await supabase
    .from("profiles")
    .select("role")
    .eq("id", user.id)
    .single();
  if (profile?.role !== "admin") return jsonResponse({ error: "admin only" }, 403);

  const { data: shipment } = await supabase
    .from("shipments")
    .select("*, profiles!user_id(full_name, email, phone)")
    .eq("id", shipment_id)
    .single();
  if (!shipment) return jsonResponse({ error: "envío no encontrado" }, 404);
  if (shipment.status !== "paid") {
    return jsonResponse({ error: `envío en estado ${shipment.status}, debe estar paid` }, 400);
  }

  const { data: originSetting } = await supabase
    .from("site_settings")
    .select("value")
    .eq("key", "shipping_origin")
    .single();
  const origin = originSetting?.value ?? {};

  const dest = shipment.destination_address ?? {};
  const branch = shipment.destination_branch ?? null;
  const profileRow = (shipment as any).profiles ?? {};
  const carrier = (shipment.carrier as Carrier) ?? "andreani";

  let trackingNumber = "";
  let remito = "";
  let estado = "";
  let estimatedDelivery: string | null = null;
  let labelUrl: string | null = null;
  let raw: unknown = null;
  let mode = "mock";

  if (carrier === "correo_argentino") {
    const creds = getCorreoCreds();
    mode = creds.mode;
    const r = await correoCreateOrder(creds, {
      destinationType: shipment.destination_type,
      productType: shipment.destination_type === "sucursal" ? "ENC_SUC" : "ENC_DOM",
      origen: {
        codigoPostal: origin.codigo_postal,
        calle: origin.calle,
        numero: origin.numero,
        localidad: origin.localidad,
        region: origin.region,
        nombreCompleto: origin.razon_social || origin.nombre_comercial || "Cancerianas",
        documentoTipo: "CUIT",
        documentoNumero: origin.cuit || "00000000000",
        email: origin.email || "noreply@cancerianas.com",
        telefono: origin.telefono || undefined,
      },
      destino: {
        postal:
          shipment.destination_type === "domicilio"
            ? {
                codigoPostal: dest.codigoPostal,
                calle: dest.calle,
                numero: dest.numero,
                piso: dest.piso,
                depto: dest.depto,
                localidad: dest.localidad,
                region: dest.region,
              }
            : undefined,
        sucursal:
          shipment.destination_type === "sucursal" && branch
            ? { id: branch.id, nombre: branch.nombre }
            : undefined,
        nombreCompleto: dest.nombre_completo || profileRow.full_name || "Sin nombre",
        documentoTipo: "DNI",
        documentoNumero: dest.documento || "00000000",
        email: profileRow.email || "",
        telefono: dest.telefono || profileRow.phone || undefined,
      },
      bultos: [
        {
          kilos: shipment.weight_grams / 1000,
          largoCm: shipment.length_cm ?? 25,
          anchoCm: shipment.width_cm ?? 20,
          altoCm: shipment.height_cm ?? 10,
          valorDeclarado: Number(shipment.declared_value || 0),
          descripcion: shipment.description,
        },
      ],
      externalReference: `shipment-${shipment_id}`,
    });
    trackingNumber = r.trackingNumber;
    remito = r.remito;
    estado = r.estado;
    estimatedDelivery = r.fechaEstimadaDeEntrega;
    labelUrl = r.labelUrl;
    raw = r.raw;
  } else {
    const creds = getAndreaniCreds();
    mode = creds.mode;
    const r = await andreaniCreateOrder(creds, {
      destinationType: shipment.destination_type,
      origen: {
        codigoPostal: origin.codigo_postal,
        calle: origin.calle,
        numero: origin.numero,
        localidad: origin.localidad,
        region: origin.region,
      },
      destino:
        shipment.destination_type === "sucursal"
          ? { sucursal: { id: branch?.id, nombre: branch?.nombre } }
          : {
              postal: {
                codigoPostal: dest.codigoPostal,
                calle: dest.calle,
                numero: dest.numero,
                localidad: dest.localidad,
                region: dest.region,
              },
            },
      remitente: {
        nombreCompleto: origin.razon_social || origin.nombre_comercial || "Cancerianas",
        email: origin.email || "noreply@cancerianas.com",
        documentoTipo: "CUIT",
        documentoNumero: origin.cuit || "00000000000",
        telefono: origin.telefono || undefined,
      },
      destinatario: {
        nombreCompleto: dest.nombre_completo || profileRow.full_name || "Sin nombre",
        email: profileRow.email || "",
        documentoTipo: "DNI",
        documentoNumero: dest.documento || "00000000",
        telefono: dest.telefono || profileRow.phone || undefined,
      },
      productoAEntregar: shipment.description,
      bultos: [
        {
          kilos: shipment.weight_grams / 1000,
          largoCm: shipment.length_cm ?? undefined,
          altoCm: shipment.height_cm ?? undefined,
          anchoCm: shipment.width_cm ?? undefined,
          valorDeclaradoConImpuestos: Number(shipment.declared_value || 0),
          descripcion: shipment.description,
        },
      ],
    });
    trackingNumber = r.trackingNumber;
    remito = r.etiquetaRemito;
    estado = r.estado;
    estimatedDelivery = r.fechaEstimadaDeEntrega;
    raw = r.raw;
  }

  await supabase
    .from("shipments")
    .update({
      // genéricos
      carrier_tracking_number: trackingNumber,
      carrier_remito: remito,
      carrier_label_url: labelUrl,
      carrier_estimated_delivery: estimatedDelivery,
      carrier_response: raw,
      carrier_last_status: estado,
      // legacy andreani_* (sólo si carrier=andreani, para no romper UI vieja)
      ...(carrier === "andreani"
        ? {
            andreani_tracking_number: trackingNumber,
            andreani_remito: remito,
            andreani_estimated_delivery: estimatedDelivery,
            andreani_response: raw as any,
            andreani_last_status: estado,
          }
        : {}),
      status: "label_generated",
    })
    .eq("id", shipment_id);

  await supabase.from("shipment_events").insert({
    shipment_id,
    status: "label_generated",
    source: carrier === "correo_argentino" ? "correo_argentino" : "andreani",
    message: `Etiqueta generada · tracking ${trackingNumber}`,
    payload: raw as any,
  });

  return jsonResponse({
    ok: true,
    carrier,
    tracking: trackingNumber,
    remito,
    fechaEstimadaDeEntrega: estimatedDelivery,
    mode,
  });
}

// ============================================================
// TRACK
// ============================================================
async function handleTrack(body: any, _req: Request) {
  const { shipment_id, tracking } = body;
  const supabase = getSupabaseAdmin();

  let trackingNumber = tracking;
  let shipmentRow: any = null;
  let carrier: Carrier = "andreani";

  if (shipment_id) {
    const { data } = await supabase
      .from("shipments")
      .select("id, carrier, andreani_tracking_number, carrier_tracking_number, status")
      .eq("id", shipment_id)
      .single();
    shipmentRow = data;
    carrier = (data?.carrier as Carrier) ?? "andreani";
    trackingNumber = data?.carrier_tracking_number || data?.andreani_tracking_number;
  } else if (body?.carrier) {
    carrier = pickCarrier(body);
  }

  if (!trackingNumber) {
    return jsonResponse({ error: "no hay tracking number" }, 400);
  }

  let eventos: any[] = [];
  let mode = "mock";

  if (carrier === "correo_argentino") {
    const creds = getCorreoCreds();
    mode = creds.mode;
    eventos = await correoTracking(creds, trackingNumber);
  } else {
    const creds = getAndreaniCreds();
    mode = creds.mode;
    eventos = await andreaniTracking(creds, trackingNumber);
  }

  if (shipmentRow) {
    const last = eventos[0];
    if (last) {
      const newStatus =
        carrier === "correo_argentino" ? mapCorreoStatus(last.estado) : mapAndreaniStatus(last.estado);
      const updates: any = {
        carrier_last_status: last.estado,
        carrier_last_polled_at: new Date().toISOString(),
        ...(carrier === "andreani"
          ? {
              andreani_last_status: last.estado,
              andreani_last_polled_at: new Date().toISOString(),
            }
          : {}),
      };
      if (newStatus && newStatus !== shipmentRow.status) {
        updates.status = newStatus;
        if (newStatus === "delivered") updates.delivered_at = last.fecha;
      }
      await supabase.from("shipments").update(updates).eq("id", shipmentRow.id);

      await supabase.from("shipment_events").insert({
        shipment_id: shipmentRow.id,
        status: newStatus ?? shipmentRow.status,
        source: carrier === "correo_argentino" ? "correo_argentino" : "andreani",
        message: `${last.estado} · ${last.motivo} · ${last.sucursal ?? ""}`,
        payload: last as any,
      });
    }
  }

  return jsonResponse({ ok: true, carrier, eventos, mode });
}

// ============================================================
// LABEL — admin descarga el PDF (sólo Andreani por ahora)
// ============================================================
async function handleLabel(body: any, req: Request) {
  const { shipment_id, remito } = body;
  const supabase = getSupabaseAdmin();
  const userClient = getSupabaseFromRequest(req);
  const { data: { user } } = await userClient.auth.getUser();
  if (!user) return jsonResponse({ error: "no auth" }, 401);

  const { data: profile } = await supabase
    .from("profiles")
    .select("role")
    .eq("id", user.id)
    .single();
  if (profile?.role !== "admin") return jsonResponse({ error: "admin only" }, 403);

  let r = remito;
  let carrier: Carrier = "andreani";
  if (!r && shipment_id) {
    const { data } = await supabase
      .from("shipments")
      .select("carrier, carrier_remito, andreani_remito, carrier_label_url")
      .eq("id", shipment_id)
      .single();
    r = data?.carrier_remito || data?.andreani_remito;
    carrier = (data?.carrier as Carrier) ?? "andreani";

    // Correo Argentino entrega URL del PDF, redirigimos
    if (carrier === "correo_argentino" && data?.carrier_label_url) {
      return jsonResponse({ ok: true, carrier, label_url: data.carrier_label_url });
    }
  }

  if (!r) return jsonResponse({ error: "remito no encontrado" }, 400);

  if (carrier === "correo_argentino") {
    return jsonResponse(
      { error: "Etiqueta de Correo Argentino se descarga desde su portal con el remito " + r },
      400
    );
  }

  const creds = getAndreaniCreds();
  const { pdf, mime } = await andreaniLabel(creds, r);

  return new Response(pdf, {
    status: 200,
    headers: {
      ...corsHeaders,
      "Content-Type": mime,
      "Content-Disposition": `inline; filename="rotulo-${r}.pdf"`,
    },
  });
}
