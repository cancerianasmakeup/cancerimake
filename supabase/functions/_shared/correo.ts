// Cliente Correo Argentino (Deno) — login + cotización + creación de orden + tracking + etiqueta.
// Endpoints oficiales (https://www.correoargentino.com.ar/MiCorreo/public/img/pag/apiMiCorreo.pdf):
//   POST  /token                    - obtener token con userToken+passwordToken
//   POST  /users/validate           - validar credenciales y obtener customerId
//   POST  /rates                    - cotizar
//   GET   /agencies?provinceCode=X  - listar sucursales
//   POST  /shipping/import          - generar etiqueta / importar envío
//   GET   /shipping/tracking        - tracking
// Soporta MOCK MODE (cuando CORREO_MODE=mock o no hay credenciales) para desarrollo
// sin convenio firmado.

const TEST_BASE = "https://apitest.correoargentino.com.ar/micorreo/v1";
const PROD_BASE = "https://api.correoargentino.com.ar/micorreo/v1";

export interface CorreoCreds {
  userToken: string;
  passwordToken: string;
  email: string;
  password: string;
  customerId: string;
  mode: "mock" | "sandbox" | "production";
}

export function getCorreoCreds(): CorreoCreds {
  const mode = (Deno.env.get("CORREO_MODE") ?? "mock").toLowerCase() as
    | "mock"
    | "sandbox"
    | "production";

  return {
    userToken: Deno.env.get("CORREO_USER_TOKEN") ?? "",
    passwordToken: Deno.env.get("CORREO_PASSWORD_TOKEN") ?? "",
    email: Deno.env.get("CORREO_EMAIL") ?? "",
    password: Deno.env.get("CORREO_PASSWORD") ?? "",
    customerId: Deno.env.get("CORREO_CUSTOMER_ID") ?? "",
    mode,
  };
}

function getBaseUrl(mode: string) {
  return mode === "production" ? PROD_BASE : TEST_BASE;
}

// ============================================================
// LOGIN — devuelve { token, customerId }
// ============================================================
interface CorreoSession {
  token: string;
  customerId: string;
}

let _cachedSession: { session: CorreoSession; exp: number } | null = null;

export async function correoLogin(creds: CorreoCreds): Promise<CorreoSession> {
  if (creds.mode === "mock") {
    return { token: "MOCK_TOKEN", customerId: creds.customerId || "MOCK_CUSTOMER" };
  }

  // Cache 30 min para no pegarle a /token en cada request
  if (_cachedSession && _cachedSession.exp > Date.now()) return _cachedSession.session;

  const baseUrl = getBaseUrl(creds.mode);

  // POST /token con userToken+passwordToken
  const tokenRes = await fetch(`${baseUrl}/token`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ userToken: creds.userToken, passwordToken: creds.passwordToken }),
  });
  if (!tokenRes.ok) {
    throw new Error(`Correo /token failed: ${tokenRes.status} ${await tokenRes.text()}`);
  }
  const tokenData = await tokenRes.json();
  const token = tokenData.token ?? tokenData.accessToken ?? tokenData.access_token;
  if (!token) throw new Error("Correo /token: no token in response");

  // Si ya tenemos customerId por env, listo
  let customerId = creds.customerId;
  if (!customerId) {
    const validateRes = await fetch(`${baseUrl}/users/validate`, {
      method: "POST",
      headers: { "Content-Type": "application/json", Authorization: `Bearer ${token}` },
      body: JSON.stringify({ email: creds.email, password: creds.password }),
    });
    if (!validateRes.ok) {
      throw new Error(`Correo /users/validate ${validateRes.status}: ${await validateRes.text()}`);
    }
    const validateData = await validateRes.json();
    customerId = validateData.customerId ?? validateData.customer_id;
    if (!customerId) throw new Error("Correo /users/validate: no customerId in response");
  }

  const session: CorreoSession = { token, customerId };
  _cachedSession = { session, exp: Date.now() + 25 * 60 * 1000 };
  return session;
}

// ============================================================
// COTIZAR
// ============================================================
export interface CorreoQuoteParams {
  cpDestino: string;
  cpOrigen: string;
  destinationType: "domicilio" | "sucursal";
  bultos: Array<{ kilos: number; largoCm: number; anchoCm: number; altoCm: number }>;
}

export interface CorreoQuoteRate {
  productType: string;
  productName: string;
  price: number;
  deliveryTimeMin: string;
  deliveryTimeMax: string;
}

export interface CorreoQuoteResult {
  rates: CorreoQuoteRate[];
  bestRate: CorreoQuoteRate;
  validTo: string;
  raw?: unknown;
}

export async function correoQuote(
  creds: CorreoCreds,
  params: CorreoQuoteParams
): Promise<CorreoQuoteResult> {
  if (creds.mode === "mock") {
    const totalKilos = params.bultos.reduce((s, b) => s + b.kilos, 0);
    // Mock: Correo Argentino suele ser ~30% más barato que Andreani
    const baseTarifa = params.destinationType === "sucursal" ? 2200 : 3400;
    const porKilo = params.destinationType === "sucursal" ? 600 : 900;
    const price = baseTarifa + porKilo * totalKilos;
    const rate: CorreoQuoteRate = {
      productType: params.destinationType === "sucursal" ? "ENC_SUC" : "ENC_DOM",
      productName: params.destinationType === "sucursal" ? "Encomienda - Sucursal" : "Encomienda - Domicilio",
      price,
      deliveryTimeMin: "3",
      deliveryTimeMax: "7",
    };
    return {
      rates: [rate],
      bestRate: rate,
      validTo: new Date(Date.now() + 86400000).toISOString(),
      raw: { __mock: true },
    };
  }

  const session = await correoLogin(creds);
  const body = {
    customerId: session.customerId,
    postalCodeOrigin: params.cpOrigen,
    postalCodeDestination: params.cpDestino,
    deliveredType: params.destinationType === "sucursal" ? "S" : "D",
    dimensions: params.bultos.map((b) => ({
      weight: Math.round(b.kilos * 1000), // gramos
      height: Math.round(b.altoCm),
      width: Math.round(b.anchoCm),
      length: Math.round(b.largoCm),
      quantity: 1,
    })),
  };

  const res = await fetch(`${getBaseUrl(creds.mode)}/rates`, {
    method: "POST",
    headers: { "Content-Type": "application/json", Authorization: `Bearer ${session.token}` },
    body: JSON.stringify(body),
  });
  if (!res.ok) throw new Error(`Correo /rates ${res.status}: ${await res.text()}`);
  const data = await res.json();
  const rates: CorreoQuoteRate[] = (data.rates ?? []).map((r: any) => ({
    productType: r.productType,
    productName: r.productName,
    price: Number(r.price),
    deliveryTimeMin: String(r.deliveryTimeMin),
    deliveryTimeMax: String(r.deliveryTimeMax),
  }));
  if (!rates.length) throw new Error("Correo /rates: no rates returned");
  const bestRate = rates.reduce((min, r) => (r.price < min.price ? r : min), rates[0]);
  return { rates, bestRate, validTo: data.validTo, raw: data };
}

// ============================================================
// SUCURSALES
// ============================================================
export interface CorreoBranch {
  id: string;
  nombre: string;
  direccion: string;
  localidad: string;
  region: string;
  codigoPostal: string;
  horario?: string;
}

const PROVINCE_CODES: Record<string, string> = {
  "Buenos Aires": "B",
  "CABA": "C",
  "Catamarca": "K",
  "Chaco": "H",
  "Chubut": "U",
  "Córdoba": "X",
  "Corrientes": "W",
  "Entre Ríos": "E",
  "Formosa": "P",
  "Jujuy": "Y",
  "La Pampa": "L",
  "La Rioja": "F",
  "Mendoza": "M",
  "Misiones": "N",
  "Neuquén": "Q",
  "Río Negro": "R",
  "Salta": "A",
  "San Juan": "J",
  "San Luis": "D",
  "Santa Cruz": "Z",
  "Santa Fe": "S",
  "Santiago del Estero": "G",
  "Tierra del Fuego": "V",
  "Tucumán": "T",
};

export async function correoAgencies(creds: CorreoCreds, region: string): Promise<CorreoBranch[]> {
  if (creds.mode === "mock") {
    return [
      {
        id: "MOCK-CA-001",
        nombre: "Correo Argentino - Sucursal Centro (mock)",
        direccion: "Av. Mitre 100",
        localidad: "Moreno",
        region,
        codigoPostal: "1744",
        horario: "Lun-Vie 9:00-17:00",
      },
      {
        id: "MOCK-CA-002",
        nombre: "Correo Argentino - Sucursal Norte (mock)",
        direccion: "Belgrano 250",
        localidad: "Moreno",
        region,
        codigoPostal: "1744",
        horario: "Lun-Vie 9:00-17:00",
      },
    ];
  }

  const session = await correoLogin(creds);
  const provinceCode = PROVINCE_CODES[region] ?? "B";
  const res = await fetch(
    `${getBaseUrl(creds.mode)}/agencies?provinceCode=${encodeURIComponent(provinceCode)}`,
    { headers: { Authorization: `Bearer ${session.token}` } }
  );
  if (!res.ok) throw new Error(`Correo /agencies ${res.status}: ${await res.text()}`);
  const data = await res.json();
  const items = Array.isArray(data) ? data : data.agencies ?? data.items ?? [];
  return items.map((a: any) => ({
    id: String(a.id ?? a.code ?? a.agencyId),
    nombre: a.name ?? a.nombre ?? "",
    direccion: [a.address, a.streetNumber].filter(Boolean).join(" ") || a.direccion || "",
    localidad: a.city ?? a.localidad ?? "",
    region: a.province ?? a.region ?? region,
    codigoPostal: String(a.postalCode ?? a.codigoPostal ?? ""),
    horario: a.openingHours ?? a.horario,
  }));
}

// ============================================================
// CREAR ORDEN / IMPORTAR ENVÍO
// ============================================================
export interface CorreoCreateOrderParams {
  destinationType: "domicilio" | "sucursal";
  productType: string; // del bestRate
  origen: {
    codigoPostal: string;
    calle: string;
    numero: string;
    localidad: string;
    region: string;
    nombreCompleto: string;
    documentoTipo: string;
    documentoNumero: string;
    email: string;
    telefono?: string;
  };
  destino: {
    postal?: {
      codigoPostal: string;
      calle: string;
      numero: string;
      piso?: string;
      depto?: string;
      localidad: string;
      region: string;
    };
    sucursal?: { id: string; nombre: string };
    nombreCompleto: string;
    documentoTipo: string;
    documentoNumero: string;
    email: string;
    telefono?: string;
  };
  bultos: Array<{
    kilos: number;
    largoCm: number;
    anchoCm: number;
    altoCm: number;
    valorDeclarado: number;
    descripcion?: string;
  }>;
  externalReference?: string;
}

export interface CorreoCreateOrderResult {
  estado: string;
  trackingNumber: string;
  remito: string;
  labelUrl: string | null;
  fechaEstimadaDeEntrega: string | null;
  raw: unknown;
}

export async function correoCreateOrder(
  creds: CorreoCreds,
  params: CorreoCreateOrderParams
): Promise<CorreoCreateOrderResult> {
  if (creds.mode === "mock") {
    const tracking = `CAMOCK${Date.now().toString().slice(-10)}`;
    return {
      estado: "Importado",
      trackingNumber: tracking,
      remito: tracking,
      labelUrl: null,
      fechaEstimadaDeEntrega: new Date(Date.now() + 5 * 86400000).toISOString().slice(0, 10),
      raw: { __mock: true, tracking },
    };
  }

  const session = await correoLogin(creds);
  const body = {
    customerId: session.customerId,
    productType: params.productType,
    deliveredType: params.destinationType === "sucursal" ? "S" : "D",
    sender: {
      name: params.origen.nombreCompleto,
      documentType: params.origen.documentoTipo,
      documentNumber: params.origen.documentoNumero,
      email: params.origen.email,
      phone: params.origen.telefono,
      address: {
        postalCode: params.origen.codigoPostal,
        street: params.origen.calle,
        streetNumber: params.origen.numero,
        city: params.origen.localidad,
        province: params.origen.region,
      },
    },
    receiver: {
      name: params.destino.nombreCompleto,
      documentType: params.destino.documentoTipo,
      documentNumber: params.destino.documentoNumero,
      email: params.destino.email,
      phone: params.destino.telefono,
      address:
        params.destinationType === "domicilio" && params.destino.postal
          ? {
              postalCode: params.destino.postal.codigoPostal,
              street: params.destino.postal.calle,
              streetNumber: params.destino.postal.numero,
              floor: params.destino.postal.piso,
              apartment: params.destino.postal.depto,
              city: params.destino.postal.localidad,
              province: params.destino.postal.region,
            }
          : undefined,
      agency:
        params.destinationType === "sucursal" && params.destino.sucursal
          ? { id: params.destino.sucursal.id, name: params.destino.sucursal.nombre }
          : undefined,
    },
    items: params.bultos.map((b, i) => ({
      reference: `${params.externalReference ?? "ENV"}-${i + 1}`,
      weight: Math.round(b.kilos * 1000),
      height: b.altoCm,
      width: b.anchoCm,
      length: b.largoCm,
      declaredValue: b.valorDeclarado,
      description: b.descripcion ?? "Mercadería Cancerianas",
      quantity: 1,
    })),
    externalReference: params.externalReference,
  };

  const res = await fetch(`${getBaseUrl(creds.mode)}/shipping/import`, {
    method: "POST",
    headers: { "Content-Type": "application/json", Authorization: `Bearer ${session.token}` },
    body: JSON.stringify(body),
  });
  if (!res.ok) throw new Error(`Correo /shipping/import ${res.status}: ${await res.text()}`);
  const data = await res.json();
  const tracking =
    data.trackingNumber ?? data.tracking ?? data.shipmentNumber ?? data.shipmentId ?? "";
  return {
    estado: data.status ?? data.estado ?? "Importado",
    trackingNumber: String(tracking),
    remito: String(data.remito ?? data.barcode ?? tracking),
    labelUrl: data.labelUrl ?? data.label ?? null,
    fechaEstimadaDeEntrega: data.estimatedDelivery ?? null,
    raw: data,
  };
}

// ============================================================
// TRACKING
// ============================================================
export interface CorreoTrackingEvent {
  fecha: string;
  estado: string;
  motivo: string;
  sucursal?: string;
  ciclo?: string;
}

export async function correoTracking(
  creds: CorreoCreds,
  trackingNumber: string
): Promise<CorreoTrackingEvent[]> {
  if (creds.mode === "mock") {
    return [
      {
        fecha: new Date().toISOString(),
        estado: "EN_TRANSITO",
        motivo: "Mock event - en tránsito Correo Argentino",
        sucursal: "CENTRO_DISTRIBUCION_BS_AS",
        ciclo: "DISTRIBUCION",
      },
    ];
  }

  const session = await correoLogin(creds);
  const qs = new URLSearchParams({ shipmentNumber: trackingNumber, customerId: session.customerId });
  const res = await fetch(`${getBaseUrl(creds.mode)}/shipping/tracking?${qs.toString()}`, {
    headers: { Authorization: `Bearer ${session.token}` },
  });
  if (!res.ok) throw new Error(`Correo /shipping/tracking ${res.status}: ${await res.text()}`);
  const data = await res.json();
  const events = Array.isArray(data) ? data : data.events ?? data.tracking ?? [];
  return events.map((e: any) => ({
    fecha: e.date ?? e.fecha ?? "",
    estado: e.status ?? e.estado ?? "",
    motivo: e.description ?? e.motivo ?? "",
    sucursal: e.branch ?? e.sucursal,
    ciclo: e.cycle ?? e.ciclo,
  }));
}

// ============================================================
// Map de estados Correo Argentino → estados internos shipment_status
// ============================================================
export function mapCorreoStatus(
  estado: string
): "in_transit" | "out_for_delivery" | "delivered" | "returned" | "failed" | null {
  const e = (estado || "").toUpperCase().trim();
  if (e.includes("ENTREG")) return "delivered";
  if (e.includes("DEVUEL") || e.includes("RECHAZ")) return "returned";
  if (e.includes("FALL") || e.includes("FALLIDO") || e.includes("NO_ENTREG")) return "failed";
  if (e.includes("REPARTO") || e.includes("DISTRIB") || e.includes("DELIVERY")) return "out_for_delivery";
  if (e.includes("TRANSIT") || e.includes("EN_RUTA") || e.includes("PROCESS")) return "in_transit";
  return null;
}
