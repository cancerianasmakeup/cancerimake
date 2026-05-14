"use client";

import { useState } from "react";
import { MapPin, Crosshair, Loader2, ExternalLink, CheckCircle2, X } from "lucide-react";
import { toast } from "sonner";

export type PickedBranch = {
  name: string;
  address: string;
  operator?: string;
  lat: number;
  lng: number;
  distance_km?: number;
  /** ID interno del nodo OSM, sirve para deduplicar y log. */
  osm_id?: string | number;
};

type Props = {
  selected: PickedBranch | null;
  onSelect: (b: PickedBranch | null) => void;
};

// Query Overpass: post offices en un radio del punto dado.
// amenity=post_office cubre la mayoría de los Correo Argentino + OCA + privados.
async function fetchNearbyBranches(lat: number, lng: number, radiusKm: number): Promise<PickedBranch[]> {
  const radiusM = Math.round(radiusKm * 1000);
  const query = `
    [out:json][timeout:25];
    (
      node(around:${radiusM},${lat},${lng})["amenity"="post_office"];
      way(around:${radiusM},${lat},${lng})["amenity"="post_office"];
    );
    out center tags;
  `;
  const res = await fetch("https://overpass-api.de/api/interpreter", {
    method: "POST",
    body: query,
    headers: { "Content-Type": "text/plain" },
  });
  if (!res.ok) throw new Error("No pudimos consultar el mapa");
  const data = await res.json();
  const items: PickedBranch[] = (data.elements ?? [])
    .map((el: any): PickedBranch | null => {
      const tags = el.tags ?? {};
      const elat = el.lat ?? el.center?.lat;
      const elng = el.lon ?? el.center?.lon;
      if (typeof elat !== "number" || typeof elng !== "number") return null;
      const name = tags.name || tags["name:es"] || tags.operator || "Sucursal de correo";
      const street = [tags["addr:street"], tags["addr:housenumber"]].filter(Boolean).join(" ");
      const locality = [tags["addr:city"], tags["addr:state"]].filter(Boolean).join(", ");
      const address = [street, locality].filter(Boolean).join(" · ");
      return {
        name,
        address,
        operator: tags.operator || tags.brand || undefined,
        lat: elat,
        lng: elng,
        distance_km: haversineKm(lat, lng, elat, elng),
        osm_id: `${el.type}/${el.id}`,
      };
    })
    .filter((x: PickedBranch | null): x is PickedBranch => !!x)
    .sort((a: PickedBranch, b: PickedBranch) => (a.distance_km ?? 0) - (b.distance_km ?? 0))
    .slice(0, 12);

  // Para los que no traen address de Overpass, los pasamos por Photon
  // (reverse geocoder gratis basado en OSM con buena cobertura de direcciones).
  // Lo hacemos en paralelo con un timeout por las dudas — si Photon falla
  // simplemente quedan sin address (no rompemos la lista).
  const needsAddr = items.filter(b => !b.address);
  if (needsAddr.length > 0) {
    await Promise.all(
      needsAddr.map(async (b) => {
        try {
          const photonUrl = `https://photon.komoot.io/reverse?lat=${b.lat}&lon=${b.lng}&lang=es&limit=1`;
          const r = await fetch(photonUrl, { signal: AbortSignal.timeout(4000) });
          if (!r.ok) return;
          const j = await r.json();
          const p = j.features?.[0]?.properties;
          if (!p) return;
          const street = [p.street, p.housenumber].filter(Boolean).join(" ");
          const locality = [p.city || p.locality, p.state].filter(Boolean).join(", ");
          const addr = [street, locality].filter(Boolean).join(" · ");
          if (addr) b.address = addr;
        } catch {
          // ignoramos errores de reverse geocoding individuales
        }
      })
    );
  }

  return items;
}

function haversineKm(lat1: number, lon1: number, lat2: number, lon2: number): number {
  const toRad = (x: number) => (x * Math.PI) / 180;
  const R = 6371;
  const dLat = toRad(lat2 - lat1);
  const dLon = toRad(lon2 - lon1);
  const a =
    Math.sin(dLat / 2) ** 2 +
    Math.cos(toRad(lat1)) * Math.cos(toRad(lat2)) * Math.sin(dLon / 2) ** 2;
  return R * 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
}

export default function BranchPicker({ selected, onSelect }: Props) {
  const [loading, setLoading] = useState(false);
  const [branches, setBranches] = useState<PickedBranch[] | null>(null);
  const [coords, setCoords] = useState<{ lat: number; lng: number } | null>(null);

  function requestGeolocation() {
    if (!navigator.geolocation) {
      toast.error("Tu navegador no soporta geolocalización");
      return;
    }
    setLoading(true);
    navigator.geolocation.getCurrentPosition(
      async (pos) => {
        const { latitude, longitude } = pos.coords;
        setCoords({ lat: latitude, lng: longitude });
        try {
          let results = await fetchNearbyBranches(latitude, longitude, 5);
          // Si no hay resultados cerca, ampliamos el radio hasta 20km
          if (results.length === 0) results = await fetchNearbyBranches(latitude, longitude, 20);
          if (results.length === 0) {
            toast.warning("No encontramos sucursales cerca tuyo. Probá cargar tu localidad o dejá nota.");
          }
          setBranches(results);
        } catch (e: any) {
          toast.error(e?.message || "Error consultando el mapa");
        } finally {
          setLoading(false);
        }
      },
      (err) => {
        setLoading(false);
        if (err.code === err.PERMISSION_DENIED) {
          toast.error("Permitinos usar tu ubicación para buscar sucursales");
        } else {
          toast.error("No pudimos obtener tu ubicación");
        }
      },
      { enableHighAccuracy: true, timeout: 10000, maximumAge: 60000 },
    );
  }

  // ─── Estado: una sucursal ya elegida ─────────────────────────────
  if (selected) {
    return (
      <div className="card border-2 border-success/40 bg-success/5">
        <div className="flex items-start gap-3">
          <CheckCircle2 className="w-5 h-5 text-success flex-shrink-0 mt-0.5" />
          <div className="flex-1 min-w-0">
            <p className="text-xs uppercase tracking-widest font-semibold text-success mb-0.5">Tu sucursal</p>
            <p className="font-semibold text-ink-primary">{selected.name}</p>
            <p className="text-sm text-ink-secondary">{selected.address}</p>
            {selected.distance_km != null && (
              <p className="text-xs text-ink-soft mt-1">a {selected.distance_km.toFixed(1)} km de tu ubicación</p>
            )}
            <a
              href={`https://www.google.com/maps/dir/?api=1&destination=${selected.lat},${selected.lng}`}
              target="_blank"
              rel="noopener"
              className="text-xs text-rose-deep hover:underline inline-flex items-center gap-1 mt-2 font-semibold"
            >
              Cómo llegar <ExternalLink className="w-3 h-3" />
            </a>
          </div>
          <button
            type="button"
            onClick={() => { onSelect(null); setBranches(null); }}
            className="p-1.5 rounded-full text-ink-soft hover:bg-rose-whisper hover:text-rose-deep"
            aria-label="Cambiar sucursal"
          >
            <X className="w-4 h-4" />
          </button>
        </div>
      </div>
    );
  }

  // ─── Estado: pidiendo geolocalización / lista ────────────────────
  return (
    <div className="card border-2 border-rose-pastel">
      <div className="flex items-start gap-2 mb-3">
        <MapPin className="w-5 h-5 text-rose-deep flex-shrink-0 mt-0.5" />
        <div className="flex-1">
          <p className="font-semibold text-ink-primary text-sm">Elegí una sucursal de correo cercana</p>
          <p className="text-xs text-ink-soft">Te mostramos las que están a menos de 5km tuyo (después ampliamos a 20km si no hay).</p>
        </div>
      </div>

      {!branches && (
        <button
          type="button"
          onClick={requestGeolocation}
          disabled={loading}
          className="btn-primary w-full"
        >
          {loading ? <Loader2 className="w-4 h-4 animate-spin" /> : <Crosshair className="w-4 h-4" />}
          {loading ? "Buscando cerca tuyo..." : "Buscar sucursales cerca mío"}
        </button>
      )}

      {branches && branches.length > 0 && (
        <div className="space-y-2 mt-2 max-h-80 overflow-y-auto pr-1">
          {branches.map(b => (
            <div
              key={String(b.osm_id)}
              className="rounded-2xl border border-rose-pastel hover:border-rose-deep hover:bg-rose-whisper p-3 transition"
            >
              <button
                type="button"
                onClick={() => onSelect(b)}
                className="w-full text-left"
              >
                <div className="flex items-start justify-between gap-2">
                  <div className="flex-1 min-w-0">
                    <p className="font-semibold text-ink-primary text-sm leading-tight">{b.name}</p>
                    {b.operator && b.operator.toLowerCase() !== b.name.toLowerCase() && (
                      <p className="text-[11px] text-rose-deep font-semibold uppercase tracking-wide">{b.operator}</p>
                    )}
                    {b.address ? (
                      <p className="text-xs text-ink-secondary mt-0.5">{b.address}</p>
                    ) : (
                      <p className="text-[11px] text-ink-soft mt-0.5 italic">Tocá &quot;Ver en mapa&quot; para ver la dirección exacta</p>
                    )}
                  </div>
                  <span className="text-[11px] text-ink-soft font-mono whitespace-nowrap">
                    {b.distance_km?.toFixed(1)} km
                  </span>
                </div>
              </button>
              <a
                href={`https://www.google.com/maps/search/?api=1&query=${b.lat},${b.lng}`}
                target="_blank"
                rel="noopener"
                onClick={(e) => e.stopPropagation()}
                className="inline-flex items-center gap-1 text-[11px] text-rose-deep hover:underline font-semibold mt-2"
              >
                Ver en mapa <ExternalLink className="w-3 h-3" />
              </a>
            </div>
          ))}
        </div>
      )}

      {branches && branches.length === 0 && coords && (
        <div className="mt-3 text-sm text-ink-secondary">
          <p className="mb-2">No encontramos sucursales etiquetadas cerca tuyo en OpenStreetMap. Probá:</p>
          <a
            href={`https://www.google.com/maps/search/correo+argentino/@${coords.lat},${coords.lng},14z`}
            target="_blank"
            rel="noopener"
            className="inline-flex items-center gap-1 text-rose-deep hover:underline font-semibold text-sm"
          >
            Ver sucursales en Google Maps <ExternalLink className="w-3 h-3" />
          </a>
          <p className="text-xs text-ink-soft mt-2">
            O escribí tu sucursal preferida en el mensaje de abajo y la coordinamos.
          </p>
        </div>
      )}

      {branches && (
        <button
          type="button"
          onClick={requestGeolocation}
          disabled={loading}
          className="text-xs text-rose-deep hover:underline mt-3"
        >
          ↻ Buscar de nuevo
        </button>
      )}
    </div>
  );
}
