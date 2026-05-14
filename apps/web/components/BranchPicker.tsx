"use client";

import { useEffect, useRef, useState } from "react";
import { MapPin, Crosshair, Loader2, ExternalLink, CheckCircle2, X, AlertCircle } from "lucide-react";
import { toast } from "sonner";

export type PickedBranch = {
  name: string;
  address: string;
  operator?: string;
  lat?: number;
  lng?: number;
  distance_km?: number;
  /** ID interno del nodo OSM, sirve para deduplicar y log. */
  osm_id?: string | number;
  /** Marcamos si el cliente la tipeó a mano (vs auto detectada por GPS). */
  source?: "gps" | "manual";
};

type Props = {
  selected: PickedBranch | null;
  onSelect: (b: PickedBranch | null) => void;
};

// Query Overpass: post offices en un radio del punto dado.
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
        source: "gps",
      };
    })
    .filter((x: PickedBranch | null): x is PickedBranch => !!x)
    .sort((a: PickedBranch, b: PickedBranch) => (a.distance_km ?? 0) - (b.distance_km ?? 0))
    .slice(0, 12);

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

type Phase = "idle" | "requesting" | "granted" | "denied" | "no-results";

export default function BranchPicker({ selected, onSelect }: Props) {
  const [phase, setPhase] = useState<Phase>("idle");
  const [branches, setBranches] = useState<PickedBranch[] | null>(null);
  const [coords, setCoords] = useState<{ lat: number; lng: number } | null>(null);
  const [manualName, setManualName] = useState("");
  const [manualAddress, setManualAddress] = useState("");
  const autoTriggered = useRef(false);

  function requestGeolocation() {
    if (!navigator.geolocation) {
      toast.error("Tu navegador no soporta geolocalización");
      setPhase("denied");
      return;
    }
    setPhase("requesting");
    navigator.geolocation.getCurrentPosition(
      async (pos) => {
        const { latitude, longitude } = pos.coords;
        setCoords({ lat: latitude, lng: longitude });
        try {
          let results = await fetchNearbyBranches(latitude, longitude, 5);
          if (results.length === 0) results = await fetchNearbyBranches(latitude, longitude, 20);
          setBranches(results);
          setPhase(results.length > 0 ? "granted" : "no-results");
        } catch (e: any) {
          toast.error(e?.message || "Error consultando el mapa");
          setPhase("denied");
        }
      },
      (err) => {
        if (err.code === err.PERMISSION_DENIED) {
          toast.warning("Sin ubicación: cargá la sucursal a mano");
        } else {
          toast.error("No pudimos obtener tu ubicación");
        }
        setPhase("denied");
      },
      { enableHighAccuracy: true, timeout: 10000, maximumAge: 60000 },
    );
  }

  // Auto-pedir ubicación al montar (sólo una vez, sólo si todavía no hay sucursal elegida)
  useEffect(() => {
    if (selected) return;
    if (autoTriggered.current) return;
    autoTriggered.current = true;
    requestGeolocation();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [selected]);

  function pickManual() {
    const name = manualName.trim();
    const address = manualAddress.trim();
    if (!name) {
      toast.error("Escribí el nombre de la sucursal");
      return;
    }
    if (!address) {
      toast.error("Escribí la dirección de la sucursal");
      return;
    }
    onSelect({ name, address, source: "manual" });
  }

  // ─── Estado: una sucursal ya elegida ─────────────────────────────
  if (selected) {
    return (
      <div className="card border-2 border-success/40 bg-success/5">
        <div className="flex items-start gap-3">
          <CheckCircle2 className="w-5 h-5 text-success flex-shrink-0 mt-0.5" />
          <div className="flex-1 min-w-0">
            <p className="text-xs uppercase tracking-widest font-semibold text-success mb-0.5">
              Tu sucursal {selected.source === "manual" && "(cargada a mano)"}
            </p>
            <p className="font-semibold text-ink-primary">{selected.name}</p>
            <p className="text-sm text-ink-secondary">{selected.address}</p>
            {selected.distance_km != null && (
              <p className="text-xs text-ink-soft mt-1">a {selected.distance_km.toFixed(1)} km de tu ubicación</p>
            )}
            {selected.lat && selected.lng && (
              <a
                href={`https://www.google.com/maps/dir/?api=1&destination=${selected.lat},${selected.lng}`}
                target="_blank"
                rel="noopener"
                className="text-xs text-rose-deep hover:underline inline-flex items-center gap-1 mt-2 font-semibold"
              >
                Cómo llegar <ExternalLink className="w-3 h-3" />
              </a>
            )}
          </div>
          <button
            type="button"
            onClick={() => { onSelect(null); setBranches(null); setPhase("idle"); autoTriggered.current = false; }}
            className="p-1.5 rounded-full text-ink-soft hover:bg-rose-whisper hover:text-rose-deep"
            aria-label="Cambiar sucursal"
          >
            <X className="w-4 h-4" />
          </button>
        </div>
      </div>
    );
  }

  // ─── Estado: pidiendo ubicación ──────────────────────────────────
  if (phase === "requesting" || phase === "idle") {
    return (
      <div className="card border-2 border-rose-deep/30 bg-rose-whisper/40 text-center py-8">
        <div className="w-16 h-16 rounded-full bg-rose-deep/15 text-rose-deep flex items-center justify-center mx-auto mb-3">
          {phase === "requesting" ? (
            <Loader2 className="w-8 h-8 animate-spin" />
          ) : (
            <Crosshair className="w-8 h-8" />
          )}
        </div>
        <p className="font-display text-lg text-ink-primary">
          {phase === "requesting" ? "Buscando sucursales cerca tuyo..." : "Necesitamos tu ubicación"}
        </p>
        <p className="text-sm text-ink-soft mt-1 px-4">
          Aceptá el permiso del navegador para mostrarte las sucursales más cercanas.
        </p>
        <p className="text-xs text-ink-soft mt-3 px-4">
          Si no te apareció el cartel del navegador, tocá el botón:
        </p>
        <button
          type="button"
          onClick={requestGeolocation}
          disabled={phase === "requesting"}
          className="btn-primary mt-3 inline-flex disabled:opacity-50"
        >
          <Crosshair className="w-4 h-4" />
          Permitir ubicación
        </button>
      </div>
    );
  }

  // ─── Estado: lista de sucursales (granted) ───────────────────────
  return (
    <div className="space-y-3">
      {phase === "granted" && branches && branches.length > 0 && (
        <div className="card border-2 border-rose-pastel">
          <div className="flex items-start gap-2 mb-3">
            <MapPin className="w-5 h-5 text-rose-deep flex-shrink-0 mt-0.5" />
            <div className="flex-1">
              <p className="font-semibold text-ink-primary text-sm">Elegí una sucursal cercana</p>
              <p className="text-xs text-ink-soft">Tocá la que te queda más fácil para retirar.</p>
            </div>
          </div>

          <div className="space-y-2 mt-2 max-h-80 overflow-y-auto pr-1">
            {branches.map(b => (
              <div
                key={String(b.osm_id)}
                className="rounded-2xl border border-rose-pastel hover:border-rose-deep hover:bg-rose-whisper p-3 transition"
              >
                <button type="button" onClick={() => onSelect(b)} className="w-full text-left">
                  <div className="flex items-start justify-between gap-2">
                    <div className="flex-1 min-w-0">
                      <p className="font-semibold text-ink-primary text-sm leading-tight">{b.name}</p>
                      {b.operator && b.operator.toLowerCase() !== b.name.toLowerCase() && (
                        <p className="text-[11px] text-rose-deep font-semibold uppercase tracking-wide">{b.operator}</p>
                      )}
                      {b.address ? (
                        <p className="text-xs text-ink-secondary mt-0.5">{b.address}</p>
                      ) : (
                        <p className="text-[11px] text-ink-soft mt-0.5 italic">Tocá &quot;Ver en mapa&quot; para ver la dirección</p>
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

          <button
            type="button"
            onClick={requestGeolocation}
            className="text-xs text-rose-deep hover:underline mt-3"
          >
            ↻ Buscar de nuevo
          </button>
        </div>
      )}

      {/* No encontró nada cerca → ofrecemos Maps + manual */}
      {phase === "no-results" && coords && (
        <div className="card border-2 border-warning/30 bg-warning/5">
          <div className="flex items-start gap-2">
            <AlertCircle className="w-5 h-5 text-warning flex-shrink-0 mt-0.5" />
            <div className="flex-1">
              <p className="font-semibold text-ink-primary text-sm">No encontramos sucursales etiquetadas cerca</p>
              <p className="text-xs text-ink-secondary mt-1">Probá buscarlas en Google Maps y después cargála abajo:</p>
              <a
                href={`https://www.google.com/maps/search/correo+argentino/@${coords.lat},${coords.lng},14z`}
                target="_blank"
                rel="noopener"
                className="inline-flex items-center gap-1 text-rose-deep hover:underline font-semibold text-xs mt-2"
              >
                Abrir Google Maps <ExternalLink className="w-3 h-3" />
              </a>
            </div>
          </div>
        </div>
      )}

      {/* Permiso denegado → mensaje grande + manual */}
      {phase === "denied" && (
        <div className="card border-2 border-warning/30 bg-warning/5">
          <div className="flex items-start gap-2">
            <AlertCircle className="w-5 h-5 text-warning flex-shrink-0 mt-0.5" />
            <div className="flex-1">
              <p className="font-semibold text-ink-primary text-sm">Sin ubicación</p>
              <p className="text-xs text-ink-secondary mt-1">Cargá los datos de la sucursal a mano abajo. O si querés, reintentá:</p>
              <button
                type="button"
                onClick={requestGeolocation}
                className="inline-flex items-center gap-1 text-rose-deep hover:underline font-semibold text-xs mt-2"
              >
                <Crosshair className="w-3 h-3" /> Reintentar ubicación
              </button>
            </div>
          </div>
        </div>
      )}

      {/* CARGA MANUAL — siempre visible si no eligió por GPS */}
      <div className="card border-2 border-rose-pastel">
        <div className="flex items-center gap-2 mb-3">
          <div className="w-8 h-8 rounded-xl bg-rose-pastel flex items-center justify-center">
            <MapPin className="w-4 h-4 text-rose-deep" />
          </div>
          <div>
            <p className="font-semibold text-ink-primary text-sm">Cargá la sucursal a mano</p>
            <p className="text-[11px] text-ink-soft">Si conocés la sucursal que querés usar.</p>
          </div>
        </div>
        <div className="space-y-2">
          <div>
            <label className="block text-xs font-semibold text-ink-secondary mb-1">Nombre de la sucursal *</label>
            <input
              value={manualName}
              onChange={e => setManualName(e.target.value)}
              placeholder="Ej: Correo Argentino Belgrano"
              className="input !h-10 !text-sm"
            />
          </div>
          <div>
            <label className="block text-xs font-semibold text-ink-secondary mb-1">Dirección de la sucursal *</label>
            <input
              value={manualAddress}
              onChange={e => setManualAddress(e.target.value)}
              placeholder="Ej: Av. Cabildo 1500, CABA"
              className="input !h-10 !text-sm"
            />
          </div>
          <button
            type="button"
            onClick={pickManual}
            disabled={!manualName.trim() || !manualAddress.trim()}
            className="btn-primary w-full mt-2 disabled:opacity-50"
          >
            <CheckCircle2 className="w-4 h-4" /> Usar esta sucursal
          </button>
        </div>
      </div>
    </div>
  );
}
