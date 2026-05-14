import { NextRequest, NextResponse } from "next/server";

// Server-side proxy a Photon (https://photon.komoot.io) para reverse geocoding.
// Resuelve dos problemas que tenía cuando se llamaba directo del browser:
//   1) CORS errors en consola cuando Photon tira 503
//   2) Múltiples errores ruidosos cuando varios resultados no tienen dirección
//
// Cacheamos en memoria por coords (~25m) para no martillar Photon si el cliente
// busca de nuevo cerca de la misma zona.

type CachedEntry = { address: string | null; expiresAt: number };
const CACHE = new Map<string, CachedEntry>();
const CACHE_TTL_MS = 24 * 60 * 60 * 1000; // 24h
const CACHE_MAX_ENTRIES = 500;

function cacheKey(lat: number, lng: number): string {
  // Redondeamos a 3 decimales (~110m) — sucursales muy cercanas comparten clave,
  // y ahorra requests.
  return `${lat.toFixed(3)},${lng.toFixed(3)}`;
}

function cacheGet(lat: number, lng: number): string | null | undefined {
  const k = cacheKey(lat, lng);
  const entry = CACHE.get(k);
  if (!entry) return undefined;
  if (entry.expiresAt < Date.now()) {
    CACHE.delete(k);
    return undefined;
  }
  return entry.address;
}

function cacheSet(lat: number, lng: number, address: string | null) {
  // LRU naive: si llenamos, sacamos el primero (Map preserva orden de inserción).
  if (CACHE.size >= CACHE_MAX_ENTRIES) {
    const first = CACHE.keys().next().value;
    if (first) CACHE.delete(first);
  }
  CACHE.set(cacheKey(lat, lng), {
    address,
    expiresAt: Date.now() + CACHE_TTL_MS,
  });
}

async function reverseGeocodePhoton(lat: number, lng: number): Promise<string | null> {
  const url = `https://photon.komoot.io/reverse?lat=${lat}&lon=${lng}&lang=es&limit=1`;
  try {
    const r = await fetch(url, {
      signal: AbortSignal.timeout(5000),
      headers: { "User-Agent": "cancerianas-makeup-app/1.0" },
    });
    if (!r.ok) return null;
    const j = await r.json();
    const p = j.features?.[0]?.properties;
    if (!p) return null;
    const street = [p.street, p.housenumber].filter(Boolean).join(" ");
    const locality = [p.city || p.locality, p.state].filter(Boolean).join(", ");
    const addr = [street, locality].filter(Boolean).join(" · ");
    return addr || null;
  } catch {
    return null;
  }
}

export async function GET(req: NextRequest) {
  const lat = parseFloat(req.nextUrl.searchParams.get("lat") ?? "");
  const lng = parseFloat(req.nextUrl.searchParams.get("lng") ?? "");

  if (!Number.isFinite(lat) || !Number.isFinite(lng)) {
    return NextResponse.json({ address: null }, { status: 400 });
  }

  const cached = cacheGet(lat, lng);
  if (cached !== undefined) {
    return NextResponse.json({ address: cached, cached: true });
  }

  const addr = await reverseGeocodePhoton(lat, lng);
  cacheSet(lat, lng, addr);
  return NextResponse.json({ address: addr });
}
