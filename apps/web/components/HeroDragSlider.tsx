"use client";

// Slider del hero (estilo tricks-menu-slider.webflow.io):
//  - LOOP infinito: la tira avanza sola mostrando todas las fotos
//  - se puede arrastrar con inercia (el loop retoma solo)
//  - skew según velocidad, hint "ARRASTRÁ", tap → foto a pantalla completa
// El contenido se triplica y la posición se envuelve para que nunca se corte.

import { useEffect, useRef, useState } from "react";
import { createPortal } from "react-dom";
import Image from "next/image";
import {
  motion,
  useMotionValue,
  useSpring,
  useAnimationFrame,
  AnimatePresence,
} from "framer-motion";
import { X, MoveHorizontal } from "lucide-react";

const IMAGES = Array.from(
  { length: 6 },
  (_, i) =>
    `https://pub-4ee8d6afe02b441fa29b28b501f5a6be.r2.dev/carrunuevo/carrunew1%20(${i + 1}).png`
);

const DRIFT_SPEED = 45; // px/s del loop automático
const COPIES = 3; // copias de la tira para el loop sin costuras

export default function HeroDragSlider() {
  const stripRef = useRef<HTMLDivElement>(null);
  const setWidth = useRef(0); // ancho de UNA copia
  const xPos = useRef(0);
  const vel = useRef(0);
  const dragging = useRef(false);
  const lastX = useRef(0);
  const lastT = useRef(0);
  const downPos = useRef({ x: 0, y: 0 });
  const moved = useRef(0);
  const [grabbing, setGrabbing] = useState(false);
  const [hasDragged, setHasDragged] = useState(false);
  const [lightbox, setLightbox] = useState<number | null>(null);
  const lightboxRef = useRef<number | null>(null);
  lightboxRef.current = lightbox;
  const [mounted, setMounted] = useState(false);
  useEffect(() => setMounted(true), []);

  const x = useMotionValue(0);
  const skew = useSpring(0, { stiffness: 260, damping: 32 });

  // Medir el ancho de una copia y arrancar en la del medio
  useEffect(() => {
    const measure = () => {
      const strip = stripRef.current;
      if (!strip) return;
      const w = strip.scrollWidth / COPIES;
      setWidth.current = w;
      if (xPos.current === 0) {
        xPos.current = -w;
        x.set(-w);
      }
    };
    measure();
    window.addEventListener("resize", measure);
    return () => window.removeEventListener("resize", measure);
  }, [x]);

  // Motor del loop: drift automático + inercia del drag + envoltura
  useAnimationFrame((_, delta) => {
    const dtSec = Math.min(delta, 64) / 1000;
    const w = setWidth.current;

    if (!dragging.current) {
      // Fricción de la inercia
      vel.current *= Math.exp(-dtSec * 2.0);
      if (Math.abs(vel.current) < 4) vel.current = 0;
      // Drift del loop (pausado con el lightbox abierto)
      const drift = lightboxRef.current != null ? 0 : -DRIFT_SPEED;
      xPos.current += (vel.current + drift) * dtSec;

      // Envolver dentro de la copia del medio
      if (w > 0) {
        if (xPos.current <= -2 * w) xPos.current += w;
        if (xPos.current > -w) xPos.current -= w;
      }
      x.set(xPos.current);
    }

    // Skew según velocidad real
    const v = dragging.current ? vel.current : vel.current * 0.6;
    skew.set(Math.max(-7, Math.min(7, -v / 220)));
  });

  const handleTap = (clientX: number, clientY: number) => {
    // Detectar qué card se tocó por posición en la tira
    const strip = stripRef.current;
    const w = setWidth.current;
    if (!strip || w <= 0) return;
    const rect = strip.getBoundingClientRect();
    const inStrip = clientX - rect.left; // px dentro de la tira triplicada
    const inSet = ((inStrip % w) + w) % w; // dentro de una copia
    const cardW = w / IMAGES.length;
    const idx = Math.min(IMAGES.length - 1, Math.max(0, Math.floor(inSet / cardW)));
    setLightbox(idx);
  };

  return (
    <div className="relative w-screen left-1/2 -translate-x-1/2">
      {/* Viewport */}
      <div
        className={`relative overflow-hidden py-3 ${grabbing ? "cursor-grabbing" : "cursor-grab"}`}
        style={{ touchAction: "pan-y" }}
        onPointerDown={(e) => {
          dragging.current = true;
          setGrabbing(true);
          moved.current = 0;
          downPos.current = { x: e.clientX, y: e.clientY };
          lastX.current = e.clientX;
          lastT.current = performance.now();
          (e.target as HTMLElement).setPointerCapture?.(e.pointerId);
        }}
        onPointerMove={(e) => {
          if (!dragging.current) return;
          const now = performance.now();
          const dx = e.clientX - lastX.current;
          const dtMs = Math.max(1, now - lastT.current);
          lastX.current = e.clientX;
          lastT.current = now;
          moved.current = Math.max(
            moved.current,
            Math.hypot(e.clientX - downPos.current.x, e.clientY - downPos.current.y)
          );
          if (moved.current > 4 && !hasDragged) setHasDragged(true);
          xPos.current += dx;
          vel.current = (dx / dtMs) * 1000;
          x.set(xPos.current);
        }}
        onPointerUp={(e) => {
          const wasTap = dragging.current && moved.current < 8;
          dragging.current = false;
          setGrabbing(false);
          if (wasTap) handleTap(e.clientX, e.clientY);
        }}
        onPointerLeave={() => {
          dragging.current = false;
          setGrabbing(false);
        }}
      >
        <motion.div
          ref={stripRef}
          style={{ x, skewX: skew }}
          className="flex gap-4 md:gap-6 px-6 md:px-12 w-max select-none"
        >
          {Array.from({ length: COPIES }).map((_, copy) =>
            IMAGES.map((src, i) => (
              <div
                key={`${copy}-${i}`}
                className="relative shrink-0 w-[74vw] sm:w-[440px] md:w-[520px] aspect-[16/9] rounded-[1.6rem] overflow-hidden ring-1 ring-white/15 shadow-[0_24px_60px_-18px_rgba(255,143,163,0.35)] bg-white/5"
              >
                <Image
                  src={src}
                  alt={`Cancerianas ${i + 1}`}
                  fill
                  sizes="(max-width: 640px) 74vw, 520px"
                  className="object-cover pointer-events-none select-none"
                  priority={copy === 1 && i < 2}
                />
                <div className="absolute inset-0 bg-gradient-to-t from-black/25 via-transparent to-transparent pointer-events-none" />
              </div>
            ))
          )}
        </motion.div>

        {/* Hint DRAG */}
        <AnimatePresence>
          {!hasDragged && (
            <motion.div
              initial={{ opacity: 0, scale: 0.8 }}
              animate={{ opacity: 1, scale: 1 }}
              exit={{ opacity: 0, scale: 0.7 }}
              className="absolute inset-0 flex items-center justify-center pointer-events-none"
            >
              <span className="inline-flex items-center gap-2 bg-white/12 backdrop-blur-md border border-white/25 text-white text-xs font-black uppercase tracking-[0.25em] px-5 py-3 rounded-full animate-soft-pulse shadow-[0_10px_40px_rgba(0,0,0,0.35)]">
                <MoveHorizontal className="w-4 h-4" /> Arrastrá
              </span>
            </motion.div>
          )}
        </AnimatePresence>
      </div>

      {/* Lightbox por portal (el translate del wrapper atraparía el fixed) */}
      {mounted &&
        createPortal(
          <AnimatePresence>
            {lightbox != null && (
              <motion.div
                initial={{ opacity: 0 }}
                animate={{ opacity: 1 }}
                exit={{ opacity: 0 }}
                onClick={() => setLightbox(null)}
                className="fixed inset-0 z-[60] bg-black/85 backdrop-blur-sm flex items-center justify-center p-3 md:p-8 cursor-zoom-out"
              >
                <motion.div
                  initial={{ scale: 0.85, opacity: 0 }}
                  animate={{ scale: 1, opacity: 1 }}
                  exit={{ scale: 0.9, opacity: 0 }}
                  transition={{ type: "spring", stiffness: 260, damping: 26 }}
                  className="relative w-full max-w-[1200px] aspect-[16/9]"
                >
                  <Image
                    src={IMAGES[lightbox]}
                    alt={`Cancerianas ${lightbox + 1}`}
                    fill
                    sizes="94vw"
                    className="object-contain rounded-2xl"
                  />
                  <button
                    onClick={(e) => {
                      e.stopPropagation();
                      setLightbox(null);
                    }}
                    aria-label="Cerrar"
                    className="absolute -top-2 right-0 md:-right-2 w-10 h-10 rounded-full bg-white/15 backdrop-blur border border-white/25 text-white flex items-center justify-center hover:bg-rose-deep transition"
                  >
                    <X className="w-5 h-5" />
                  </button>
                </motion.div>
              </motion.div>
            )}
          </AnimatePresence>,
          document.body
        )}
    </div>
  );
}
