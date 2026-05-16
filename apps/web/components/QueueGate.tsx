"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { createSupabaseBrowser } from "@/lib/supabase-browser";
import type { QueueSettings } from "@/lib/site-settings-types";

const SESSION_KEY = "cancerianas-queue-passed";
const PRESENCE_CHANNEL = "shop:viewers";

type Props = {
  settings: QueueSettings;
};

/**
 * QueueGate — popup tipo "estás en la cola" para crear urgencia.
 *
 * Flujo:
 * 1. Joinea al canal de presencia `shop:viewers` y cuenta cuántos hay.
 * 2. Si presence >= threshold y nunca se mostró en esta sesión → activa la cola.
 * 3. Calcula `peopleAhead0 = max(presence * multiplier, min_offset)`.
 * 4. Anima al cangrejo de izquierda a derecha durante `duration_sec`, decrementando
 *    el counter linealmente hasta llegar a 1.
 * 5. Cuando la barra llega a 100% (o el counter a 0), cierra y marca sessionStorage
 *    para no mostrarlo de nuevo a este usuario en esta sesión.
 *
 * Notas:
 * - El usuario NO puede cerrar manualmente (es lo que vende la urgencia).
 * - Si abre 2 pestañas con el shop, sólo verá la cola una vez.
 * - En SSR no hace nada; el componente está marcado "use client".
 */
export default function QueueGate({ settings }: Props) {
  const supabase = useMemo(() => createSupabaseBrowser(), []);
  const [active, setActive] = useState(false);
  const [peopleAhead, setPeopleAhead] = useState<number | null>(null);
  const [progress, setProgress] = useState(0); // 0..1
  const startTsRef = useRef<number | null>(null);
  const startCountRef = useRef<number | null>(null);
  const triggeredRef = useRef(false);

  // ===== Presence: cuenta concurrent viewers en el shop =====
  useEffect(() => {
    if (!settings.enabled) return;
    if (typeof window === "undefined") return;
    if (sessionStorage.getItem(SESSION_KEY) === "1") return;

    const channel = supabase.channel(PRESENCE_CHANNEL, {
      config: { presence: { key: crypto.randomUUID() } },
    });

    function maybeTrigger() {
      if (triggeredRef.current) return;
      const state = channel.presenceState();
      const count = Object.keys(state).length;
      if (count >= settings.threshold) {
        triggeredRef.current = true;
        const startCount = Math.max(
          count * settings.multiplier,
          settings.min_offset
        );
        startCountRef.current = startCount;
        startTsRef.current = Date.now();
        setPeopleAhead(startCount);
        setActive(true);
      }
    }

    channel
      .on("presence", { event: "sync" }, maybeTrigger)
      .on("presence", { event: "join" }, maybeTrigger)
      .subscribe((status) => {
        if (status === "SUBSCRIBED") {
          channel.track({ joined_at: Date.now() });
        }
      });

    return () => {
      channel.unsubscribe();
      supabase.removeChannel(channel);
    };
  }, [supabase, settings.enabled, settings.threshold, settings.multiplier, settings.min_offset]);

  // ===== Animación: progress + counter regresivo =====
  useEffect(() => {
    if (!active) return;
    const start = startTsRef.current!;
    const startCount = startCountRef.current!;
    const total = settings.duration_sec * 1000;

    let raf = 0;
    const tick = () => {
      const elapsed = Date.now() - start;
      const p = Math.min(elapsed / total, 1);
      setProgress(p);
      setPeopleAhead(Math.max(1, Math.round(startCount * (1 - p))));
      if (p < 1) {
        raf = requestAnimationFrame(tick);
      } else {
        sessionStorage.setItem(SESSION_KEY, "1");
        // Pequeño delay para que vean "¡Pasaste!" antes de cerrar.
        setTimeout(() => setActive(false), 1200);
      }
    };
    raf = requestAnimationFrame(tick);
    return () => cancelAnimationFrame(raf);
  }, [active, settings.duration_sec]);

  if (!settings.enabled) return null;

  return (
    <AnimatePresence>
      {active && (
        <motion.div
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0 }}
          transition={{ duration: 0.3 }}
          className="fixed inset-0 z-[200] bg-gradient-to-br from-rose-deep/95 via-rose-medium/95 to-rose-pastel/95 backdrop-blur-md flex items-center justify-center px-4"
        >
          <motion.div
            initial={{ scale: 0.9, y: 20 }}
            animate={{ scale: 1, y: 0 }}
            transition={{ type: "spring", stiffness: 220, damping: 24 }}
            className="bg-white rounded-3xl shadow-2xl max-w-lg w-full p-6 md:p-8 text-center relative overflow-hidden"
          >
            <div className="absolute -top-12 -right-12 w-40 h-40 bg-rose-whisper rounded-full opacity-50" />
            <div className="absolute -bottom-12 -left-12 w-40 h-40 bg-rose-pastel rounded-full opacity-40" />

            <div className="relative">
              <p className="text-xs uppercase tracking-widest text-rose-deep font-bold mb-1">
                Estás en la cola
              </p>
              <h2 className="font-display text-3xl md:text-4xl text-ink-primary leading-tight mb-2">
                ¡Mucha gente comprando ahora!
              </h2>
              <p className="text-ink-secondary text-sm md:text-base mb-6">
                Esperá unos segundos, ya entrás a la tienda. No cierres esta ventana — perdés tu lugar.
              </p>

              {/* Counter principal */}
              <motion.div
                key={peopleAhead}
                initial={{ scale: 1.1, opacity: 0.6 }}
                animate={{ scale: 1, opacity: 1 }}
                transition={{ duration: 0.25 }}
                className="text-7xl md:text-8xl font-black text-rose-deep mb-1 tabular-nums"
              >
                {peopleAhead?.toLocaleString("es-AR") ?? "—"}
              </motion.div>
              <p className="text-xs uppercase tracking-wider text-ink-soft mb-6">
                personas comprando antes que vos
              </p>

              {/* Track del cangrejito */}
              <div className="relative h-20 mb-2">
                {/* Pista */}
                <div className="absolute inset-x-0 top-1/2 -translate-y-1/2 h-2 bg-rose-pastel rounded-full overflow-hidden">
                  <motion.div
                    style={{ width: `${progress * 100}%` }}
                    className="h-full bg-gradient-to-r from-rose-medium to-rose-deep"
                  />
                </div>
                {/* Cangrejito corriendo */}
                <motion.div
                  className="absolute top-1/2 -translate-y-1/2 text-4xl select-none"
                  style={{ left: `calc(${progress * 100}% - 24px)` }}
                  animate={{ y: [-2, -8, -2], rotate: [-4, 4, -4] }}
                  transition={{ duration: 0.5, repeat: Infinity, ease: "easeInOut" }}
                >
                  🦀
                </motion.div>
                {/* Bandera de llegada */}
                <span className="absolute top-1/2 right-0 -translate-y-1/2 text-2xl">🏁</span>
              </div>

              <p className="text-xs text-ink-soft">
                {progress < 1
                  ? "Reservando tu lugar…"
                  : "¡Listo! Bienvenida a la tienda 🌸"}
              </p>
            </div>
          </motion.div>
        </motion.div>
      )}
    </AnimatePresence>
  );
}
