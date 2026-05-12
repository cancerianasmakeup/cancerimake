// Tienda de oportunidades — lógica pura de apertura/cierre.
// Se usa desde web (server + browser) y mobile, así que NO depende de Supabase.
// Le pasás la config + un `now` (Date) y te dice si está abierta y la próxima ventana.

export type StoreForceState = "auto" | "open" | "closed";

export interface StoreDrop {
  id: string;
  starts_at: string; // ISO timestamp
  ends_at: string; // ISO timestamp
  label?: string;
}

export interface StoreStatusConfig {
  force_state: StoreForceState;
  force_until: string | null;
  drops: StoreDrop[];
  closed_title: string;
  closed_message: string;
  closed_subtitle: string;
  open_banner_text: string;
  tiktok_url: string;
  instagram_url: string;
  timezone: string;
}

export const DEFAULT_STORE_STATUS: StoreStatusConfig = {
  force_state: "auto",
  force_until: null,
  drops: [],
  closed_title: "Volvemos pronto",
  closed_message: "Cerramos para preparar el próximo drop con ofertas exclusivas.",
  closed_subtitle: "Te avisamos cuando abrimos. Mientras tanto seguinos en TikTok.",
  open_banner_text: "⚡ TIENDA ABIERTA · ofertas exclusivas por tiempo limitado",
  tiktok_url: "https://www.tiktok.com/@cancerianas.makeup2",
  instagram_url: "",
  timezone: "America/Argentina/Buenos_Aires",
};

export interface StoreStatusResult {
  /** Si en este momento se puede comprar */
  isOpen: boolean;
  /** Por qué está abierta/cerrada */
  reason:
    | "force_open"
    | "force_closed"
    | "in_drop"
    | "no_drop"
    | "between_drops"
    | "force_expired";
  /** Cuándo cierra (si está abierta) */
  closesAt: Date | null;
  /** Cuándo abre (si está cerrada) */
  opensAt: Date | null;
  /** Drop activo si lo hay */
  activeDrop: StoreDrop | null;
  /** Próximo drop futuro si lo hay */
  nextDrop: StoreDrop | null;
}

/**
 * Calcula el estado actual de la tienda.
 * Prioridades:
 *   1. force_state === 'open' (con force_until opcional) → abierta
 *   2. force_state === 'closed' (con force_until opcional) → cerrada
 *   3. drop activo (starts_at ≤ now ≤ ends_at) → abierta
 *   4. próximo drop futuro → cerrada (con countdown)
 *   5. sin drops → cerrada permanente
 */
export function getStoreStatus(
  config: StoreStatusConfig,
  now: Date = new Date()
): StoreStatusResult {
  const nowMs = now.getTime();

  // Limpiar force expirado
  const forceUntilMs = config.force_until ? new Date(config.force_until).getTime() : null;
  const forceActive = config.force_state !== "auto" && (!forceUntilMs || forceUntilMs > nowMs);

  if (forceActive && config.force_state === "open") {
    return {
      isOpen: true,
      reason: "force_open",
      closesAt: forceUntilMs ? new Date(forceUntilMs) : null,
      opensAt: null,
      activeDrop: null,
      nextDrop: pickNextDrop(config.drops, now),
    };
  }

  if (forceActive && config.force_state === "closed") {
    const next = pickNextDrop(config.drops, now);
    return {
      isOpen: false,
      reason: "force_closed",
      closesAt: null,
      // Si force_until es futuro y antes que el próximo drop, ese marca la apertura
      opensAt: chooseEarlier(forceUntilMs ? new Date(forceUntilMs) : null, next?.starts_at ? new Date(next.starts_at) : null),
      activeDrop: null,
      nextDrop: next,
    };
  }

  // Auto: buscar drop activo
  const drops = sortDrops(config.drops);
  const active = drops.find(
    (d) => new Date(d.starts_at).getTime() <= nowMs && new Date(d.ends_at).getTime() > nowMs
  );

  if (active) {
    return {
      isOpen: true,
      reason: "in_drop",
      closesAt: new Date(active.ends_at),
      opensAt: null,
      activeDrop: active,
      nextDrop: pickNextDrop(drops, new Date(active.ends_at)),
    };
  }

  const next = pickNextDrop(drops, now);
  return {
    isOpen: false,
    reason: next ? "between_drops" : "no_drop",
    closesAt: null,
    opensAt: next ? new Date(next.starts_at) : null,
    activeDrop: null,
    nextDrop: next,
  };
}

function sortDrops(drops: StoreDrop[]): StoreDrop[] {
  return [...drops].sort(
    (a, b) => new Date(a.starts_at).getTime() - new Date(b.starts_at).getTime()
  );
}

function pickNextDrop(drops: StoreDrop[], from: Date): StoreDrop | null {
  const fromMs = from.getTime();
  const future = sortDrops(drops).filter((d) => new Date(d.starts_at).getTime() > fromMs);
  return future[0] ?? null;
}

function chooseEarlier(a: Date | null, b: Date | null): Date | null {
  if (!a) return b;
  if (!b) return a;
  return a.getTime() <= b.getTime() ? a : b;
}

// Para countdowns de UI
export interface CountdownParts {
  totalMs: number;
  days: number;
  hours: number;
  minutes: number;
  seconds: number;
  expired: boolean;
}

export function getCountdown(target: Date | null, now: Date = new Date()): CountdownParts {
  if (!target) return { totalMs: 0, days: 0, hours: 0, minutes: 0, seconds: 0, expired: true };
  const totalMs = target.getTime() - now.getTime();
  if (totalMs <= 0) return { totalMs: 0, days: 0, hours: 0, minutes: 0, seconds: 0, expired: true };
  const days = Math.floor(totalMs / 86_400_000);
  const hours = Math.floor((totalMs % 86_400_000) / 3_600_000);
  const minutes = Math.floor((totalMs % 3_600_000) / 60_000);
  const seconds = Math.floor((totalMs % 60_000) / 1000);
  return { totalMs, days, hours, minutes, seconds, expired: false };
}

/** Genera un id estable estilo uuid (no necesita crypto.randomUUID en RN) */
export function makeDropId(): string {
  // 8-4-4-4-12, basado en Math.random; suficiente para colección local manejada por admin
  const r = () => Math.floor(Math.random() * 16).toString(16);
  return Array.from({ length: 32 }, r)
    .join("")
    .replace(/^(.{8})(.{4})(.{4})(.{4})(.{12})$/, "$1-$2-$3-$4-$5");
}

/** Validación básica para formularios */
export function isValidEmail(s: string): boolean {
  return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(s.trim());
}

export function isValidPhoneAR(s: string): boolean {
  // Permisivo: dígitos, espacios, +, -, paréntesis. Mínimo 8 dígitos.
  const digits = s.replace(/\D/g, "");
  return digits.length >= 8 && digits.length <= 15;
}
