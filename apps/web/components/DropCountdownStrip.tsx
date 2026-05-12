"use client";

// Strip de countdown que se muestra debajo del banner del header
// cuando hay un drop activo. Aporta sensación de urgencia sin invadir.

import { useEffect, useMemo, useState } from "react";
import { Zap, Clock } from "lucide-react";
import {
  DEFAULT_STORE_STATUS,
  getStoreStatus,
  getCountdown,
  type StoreStatusConfig,
} from "@cancerianas/shared";
import { createSupabaseBrowser } from "@/lib/supabase-browser";

export default function DropCountdownStrip() {
  const supabase = createSupabaseBrowser();
  const [config, setConfig] = useState<StoreStatusConfig>(DEFAULT_STORE_STATUS);
  const [now, setNow] = useState(() => new Date());

  useEffect(() => {
    supabase
      .from("site_settings")
      .select("value")
      .eq("key", "store_status")
      .maybeSingle()
      .then(({ data }) => {
        if (data?.value)
          setConfig({ ...DEFAULT_STORE_STATUS, ...(data.value as Partial<StoreStatusConfig>) });
      });

    const tick = setInterval(() => setNow(new Date()), 1000);
    return () => clearInterval(tick);
  }, []);

  const status = useMemo(() => getStoreStatus(config, now), [config, now]);
  const cd = useMemo(() => getCountdown(status.closesAt, now), [status.closesAt, now]);

  // Sólo mostrar cuando hay un drop activo (no override forzado, sino dentro de drop programado)
  if (!status.isOpen || status.reason !== "in_drop" || cd.expired || !status.activeDrop) return null;

  const urgent = cd.days === 0 && cd.hours < 1; // últimos 60 min → más rojo

  return (
    <div className="max-w-6xl mx-auto px-4 mt-4">
      <div
        className={`rounded-2xl px-4 py-3 flex items-center justify-between gap-3 flex-wrap ${
          urgent
            ? "bg-gradient-to-r from-rose-deep to-error text-white animate-soft-pulse"
            : "bg-gradient-to-r from-rose-pastel via-rose-medium/30 to-rose-pastel border border-rose-medium/40"
        }`}
      >
        <div className="flex items-center gap-2 flex-1 min-w-0">
          <Zap className={`w-5 h-5 flex-shrink-0 ${urgent ? "text-white" : "text-rose-deep"}`} />
          <div className="min-w-0">
            <div
              className={`text-xs font-bold uppercase tracking-widest ${
                urgent ? "text-white/90" : "text-rose-deep"
              }`}
            >
              Drop activo
            </div>
            <div
              className={`font-display text-base md:text-lg truncate ${
                urgent ? "text-white" : "text-ink-primary"
              }`}
            >
              {status.activeDrop.label || "Ofertas exclusivas"}
            </div>
          </div>
        </div>

        <div
          className={`inline-flex items-center gap-2 px-3 py-2 rounded-full font-mono font-bold tabular-nums whitespace-nowrap ${
            urgent ? "bg-white/15 text-white" : "bg-white text-ink-primary"
          }`}
        >
          <Clock className="w-4 h-4" />
          {cd.days > 0 && `${cd.days}d `}
          {String(cd.hours).padStart(2, "0")}:
          {String(cd.minutes).padStart(2, "0")}:
          {String(cd.seconds).padStart(2, "0")}
        </div>
      </div>
    </div>
  );
}
