// Cliente Andreani (Deno) — login + cotización + creación de orden + tracking + etiqueta.
// Soporta MOCK MODE (cuando ANDREANI_MODE=mock o no hay credenciales) para poder
// desarrollar/probar sin tener convenio firmado.

const SANDBOX_BASE = "https://api.qa.andreani.com";
const PROD_BASE = "https://api.andreani.com";

export interface AndreaniCreds {
  user: string;
  pass: string;
  contratoDomicilio: string;
  contratoSucursal: string;
  codigoCliente: string;
  mode: "mock" | "sandbox" | "production";
}

export function getAndreaniCreds(): AndreaniCreds {
  const mode = (Deno.env.get("ANDREANI_MODE") ?? "mock").toLowerCase() as
    | "mock"
    | "sandbox"
    | "production";

  return {
    user: Deno.env.get("ANDREANI_USER") ?? "",
    pass: Deno.env.get("ANDREANI_PASS") ?? "",
    contratoDomicilio: Deno.env.get("ANDREANI_CONTRATO_DOMICILIO") ?? "",
    contratoSucursal: Deno.env.get("ANDREANI_CONTRATO_SUCURSAL") ?? "",
    codigoCliente: Deno.env.get("ANDREANI_CODIGO_CLIENTE") ?? "",
    mode,
  };
}

function getBaseUrl(mode: string) {
  return mode === "production" ? PROD_BASE : SANDBOX_BASE;
}

// ============================================================
// LOGIN
// ============================================================
export async function andreaniLogin(creds: AndreaniCreds): Promise<string> {
  if (creds.mode === "mock") return "MOCK_TOKEN";
  const auth = btoa(`${creds.user}:${creds.pass}`);
  const res = await fetch(`${getBaseUrl(creds.mode)}/login`, {
    method: "GET",
    headers: { Authorization: `Basic ${auth}` },
  });
  if (!res.ok) {
    throw new Error(`Andreani login failed: ${res.status} ${await res.text()}`);
  }
  const token = res.headers.get("x-authorization-token");
  if (!token) throw new Error("Andreani login: no x-authorization-token in response");
  return token;
}

// ============================================================
// COTIZAR
// ============================================================
export interface QuoteParams {
  cpDestino: string;
  sucursalOrigen: string; // código de sucursal Andreani de origen (te lo dan al firmar)
  destinationType: "domicilio" | "sucursal";
  bultos: Array<{ kilos: number; volumen: number; valorDeclarado: number }>;
}

export interface QuoteResult {
  pesoAforado: string;
  tarifaSinIva: { distribucion: string; seguroDistribucion: string; total: string };
  tarifaConIva: { distribucion: string; seguroDistribucion: string; total: string };
  raw?: unknown;
}

export async function andreaniQuote(creds: AndreaniCreds, params: QuoteParams): Promise<QuoteResult> {
  if (creds.mode === "mock") {
    // Mock realista: tarifa base + por kilo, ajustada por destinación
    const totalKilos = params.bultos.reduce((s, b) => s + b.kilos, 0);
    const totalDeclarado = params.bultos.reduce((s, b) => s + b.valorDeclarado, 0);
    const baseTarifa = params.destinationType === "sucursal" ? 2800 : 4200;
    const porKilo = params.destinationType === "sucursal" ? 800 : 1200;
    const distribucion = baseTarifa + porKilo * totalKilos;
    const seguro = totalDeclarado * 0.015;
    const totalSinIva = distribucion + seguro;
    const totalConIva = totalSinIva * 1.21;
    return {
      pesoAforado: totalKilos.toFixed(2),
      tarifaSinIva: {
        distribucion: distribucion.toFixed(2),
        seguroDistribucion: seguro.toFixed(2),
        total: totalSinIva.toFixed(2),
      },
      tarifaConIva: {
        distribucion: (distribucion * 1.21).toFixed(2),
        seguroDistribucion: (seguro * 1.21).toFixed(2),
        total: totalConIva.toFixed(2),
      },
      raw: { __mock: true },
    };
  }

  const token = await andreaniLogin(creds);
  const contrato =
    params.destinationType === "sucursal" ? creds.contratoSucursal : creds.contratoDomicilio;

  const qs = new URLSearchParams({
    cliente: creds.codigoCliente,
    contrato,
    cpDestino: params.cpDestino,
    sucursalOrigen: params.sucursalOrigen,
  });
  params.bultos.forEach((b, i) => {
    qs.append(`bultos[${i}][kilos]`, b.kilos.toString());
    qs.append(`bultos[${i}][volumen]`, b.volumen.toString());
    qs.append(`bultos[${i}][valorDeclarado]`, b.valorDeclarado.toString());
  });

  const res = await fetch(`${getBaseUrl(creds.mode)}/v1/tarifas?${qs.toString()}`, {
    headers: { "x-authorization-token": token },
  });
  if (!res.ok) throw new Error(`Andreani quote ${res.status}: ${await res.text()}`);
  const data = await res.json();
  return { ...data, raw: data };
}

// ============================================================
// CREAR ORDEN
// ============================================================
export interface CreateOrderParams {
  destinationType: "domicilio" | "sucursal";
  origen: {
    codigoPostal: string;
    calle: string;
    numero: string;
    localidad: string;
    region: string;
  };
  destino: {
    postal?: {
      codigoPostal: string;
      calle: string;
      numero: string;
      localidad: string;
      region: string;
    };
    sucursal?: { id: string; nombre: string };
  };
  remitente: {
    nombreCompleto: string;
    email: string;
    documentoTipo: string; // "CUIT" | "DNI"
    documentoNumero: string;
    telefono?: string;
  };
  destinatario: {
    nombreCompleto: string;
    email: string;
    documentoTipo: string;
    documentoNumero: string;
    telefono?: string;
  };
  productoAEntregar: string;
  bultos: Array<{
    kilos: number;
    largoCm?: number;
    altoCm?: number;
    anchoCm?: number;
    valorDeclaradoConImpuestos: number;
    descripcion?: string;
  }>;
}

export interface CreateOrderResult {
  estado: string;
  etiquetaRemito: string;
  trackingNumber: string;
  fechaEstimadaDeEntrega: string;
  raw: unknown;
}

export async function andreaniCreateOrder(
  creds: AndreaniCreds,
  params: CreateOrderParams
): Promise<CreateOrderResult> {
  if (creds.mode === "mock") {
    const tracking = `MOCK${Date.now().toString().slice(-10)}`;
    return {
      estado: "Creado",
      etiquetaRemito: tracking,
      trackingNumber: tracking,
      fechaEstimadaDeEntrega: new Date(Date.now() + 3 * 86400000).toISOString().slice(0, 10),
      raw: { __mock: true, tracking },
    };
  }

  const token = await andreaniLogin(creds);
  const contrato =
    params.destinationType === "sucursal" ? creds.contratoSucursal : creds.contratoDomicilio;

  const body = {
    contrato,
    origen: { postal: params.origen },
    destino:
      params.destinationType === "sucursal"
        ? { sucursal: params.destino.sucursal }
        : { postal: params.destino.postal },
    productoAEntregar: params.productoAEntregar,
    remitente: {
      nombreCompleto: params.remitente.nombreCompleto,
      email: params.remitente.email,
      documentoTipo: params.remitente.documentoTipo,
      documentoNumero: params.remitente.documentoNumero,
      telefonos: params.remitente.telefono
        ? [{ tipo: 1, numero: params.remitente.telefono }]
        : undefined,
    },
    destinatario: [
      {
        nombreCompleto: params.destinatario.nombreCompleto,
        email: params.destinatario.email,
        documentoTipo: params.destinatario.documentoTipo,
        documentoNumero: params.destinatario.documentoNumero,
        telefonos: params.destinatario.telefono
          ? [{ tipo: 1, numero: params.destinatario.telefono }]
          : undefined,
      },
    ],
    bultos: params.bultos,
    valorACobrar: 0,
  };

  const res = await fetch(`${getBaseUrl(creds.mode)}/v2/ordenes-de-envio`, {
    method: "POST",
    headers: {
      "x-authorization-token": token,
      "Content-Type": "application/json",
    },
    body: JSON.stringify(body),
  });
  if (!res.ok) {
    throw new Error(`Andreani create order ${res.status}: ${await res.text()}`);
  }
  const data = await res.json();
  return {
    estado: data.estado ?? "Creado",
    etiquetaRemito: data.etiquetaRemito ?? "",
    trackingNumber: data.bultos?.[0]?.numeroDeEnvio ?? data.etiquetaRemito ?? "",
    fechaEstimadaDeEntrega: data.fechaEstimadaDeEntrega ?? "",
    raw: data,
  };
}

// ============================================================
// TRACKING
// ============================================================
export interface TrackingEvent {
  fecha: string;
  estado: string;
  motivo: string;
  submotivo?: string | null;
  sucursal: string;
  ciclo: string;
}

export async function andreaniTracking(
  creds: AndreaniCreds,
  trackingNumber: string
): Promise<TrackingEvent[]> {
  if (creds.mode === "mock") {
    return [
      {
        fecha: new Date().toISOString(),
        estado: "EN_TRANSITO",
        motivo: "Mock event - en tránsito",
        sucursal: "MORENO",
        ciclo: "DISTRIBUCION",
      },
    ];
  }

  const token = await andreaniLogin(creds);
  const res = await fetch(
    `${getBaseUrl(creds.mode)}/v1/envios/${encodeURIComponent(trackingNumber)}/trazas`,
    { headers: { "x-authorization-token": token } }
  );
  if (!res.ok) throw new Error(`Andreani tracking ${res.status}: ${await res.text()}`);
  const data = await res.json();
  // Andreani devuelve un objeto con `eventos: [{Fecha, Estado, Motivo, ...}]`
  const eventos = Array.isArray(data) ? data : data.eventos ?? [];
  return eventos.map((e: any) => ({
    fecha: e.Fecha ?? e.fecha,
    estado: e.Estado ?? e.estado,
    motivo: e.Motivo ?? e.motivo,
    submotivo: e.Submotivo ?? e.submotivo ?? null,
    sucursal: e.Sucursal ?? e.sucursal,
    ciclo: e.Ciclo ?? e.ciclo,
  }));
}

// ============================================================
// ETIQUETA / RÓTULO (PDF binary)
// ============================================================
export async function andreaniLabel(
  creds: AndreaniCreds,
  remito: string
): Promise<{ pdf: Uint8Array; mime: string }> {
  if (creds.mode === "mock") {
    // Devolvemos un PDF stub con texto plano (para no romper el flujo)
    const stub = `%PDF-1.4
%MOCK
% Etiqueta mock para remito ${remito}
1 0 obj << /Type /Catalog /Pages 2 0 R >> endobj
2 0 obj << /Type /Pages /Kids [3 0 R] /Count 1 >> endobj
3 0 obj << /Type /Page /Parent 2 0 R /MediaBox [0 0 612 792] /Contents 4 0 R >> endobj
4 0 obj << /Length 80 >> stream
BT /F1 18 Tf 50 700 Td (Mock label - remito: ${remito}) Tj ET
endstream endobj
trailer << /Root 1 0 R >> %%EOF`;
    return { pdf: new TextEncoder().encode(stub), mime: "application/pdf" };
  }

  const token = await andreaniLogin(creds);
  const res = await fetch(
    `${getBaseUrl(creds.mode)}/v2/ordenes-de-envio/${encodeURIComponent(remito)}/etiquetas`,
    { headers: { "x-authorization-token": token } }
  );
  if (!res.ok) throw new Error(`Andreani label ${res.status}: ${await res.text()}`);
  const buffer = await res.arrayBuffer();
  return { pdf: new Uint8Array(buffer), mime: res.headers.get("Content-Type") ?? "application/pdf" };
}

// ============================================================
// Map de estados Andreani → estados internos
// ============================================================
export function mapAndreaniStatus(
  estado: string
): "in_transit" | "out_for_delivery" | "delivered" | "returned" | "failed" | null {
  const e = estado.toUpperCase().trim();
  if (e.includes("ENTREGAD")) return "delivered";
  if (e.includes("DEVUEL") || e.includes("RECHAZ")) return "returned";
  if (e.includes("FALL") || e.includes("FALLIDO")) return "failed";
  if (e.includes("DISTRIBU") || e.includes("REPARTO")) return "out_for_delivery";
  if (e.includes("TRANSIT") || e.includes("TRÁNSITO") || e.includes("EN_RUTA")) return "in_transit";
  return null;
}
