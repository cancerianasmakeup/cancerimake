"use client";

import { useRouter } from "next/navigation";
import { useState } from "react";
import { ArrowRight, MapPin, Sparkles } from "lucide-react";

import { BSAS_HOME_PATH, type StoreConfig, type StoreId } from "@/lib/stores";

// Versión comprimida del video del hero (1280x720, 0,5 MB contra los 16 MB del
// original). Es lo primero que carga una clienta: no puede pesar como una app.
// El póster de 16 KB pinta al instante mientras el video llega.
const BG_VIDEO = "https://pub-4ee8d6afe02b441fa29b28b501f5a6be.r2.dev/LOGOSNUEVOS/optimizados/portal-bg.mp4";
const BG_POSTER =
  "https://pub-4ee8d6afe02b441fa29b28b501f5a6be.r2.dev/LOGOSNUEVOS/optimizados/portal-poster.webp";

/**
 * Pantalla de entrada de cancerianasmakeup.com.ar: la clienta elige en qué
 * tienda quiere comprar.
 *
 * Va en oscuro a propósito: los logos son rosa metalizado sobre transparencia,
 * pensados para fondo negro — sobre blanco se apagan.
 *
 * Se muestra en la primera visita y la elección queda recordada, así quien
 * vuelve entra directo a su tienda. Desde el pie puede volver a cambiarla.
 */
export default function StorePortal({
  stores,
  localStoreId,
}: {
  stores: StoreConfig[];
  /** La tienda que sirve este deploy: se entra sin salir del dominio. */
  localStoreId: StoreId;
}) {
  const router = useRouter();
  const [pending, setPending] = useState<StoreId | null>(null);

  function pick(store: StoreConfig) {
    setPending(store.id);

    if (store.id === localStoreId) {
      // La tienda de este deploy vive en /bsas: la raíz es esta pantalla.
      router.push(BSAS_HOME_PATH);
    } else {
      // La otra tienda tiene su propio dominio y su propia base.
      window.location.href = `https://${store.domain}`;
    }
  }

  return (
    <main className="relative min-h-[100dvh] overflow-hidden bg-[#0B0509] flex items-center justify-center px-4 py-10">
      {/* Capa 1 — póster fijo: se ve si el video no carga o si el sistema pidió
          menos movimiento. */}
      <div
        aria-hidden
        className="portal-zoom absolute inset-0 bg-cover bg-center opacity-60"
        style={{ backgroundImage: `url(${BG_POSTER})` }}
      />
      {/* Capa 2 — video de marca, el mismo del hero de la tienda */}
      <video
        autoPlay
        loop
        muted
        playsInline
        preload="none"
        poster={BG_POSTER}
        aria-hidden
        className="portal-zoom absolute inset-0 w-full h-full object-cover pointer-events-none opacity-60 motion-reduce:hidden"
        src={BG_VIDEO}
      />
      {/* Capa 3 — viñeta: hunde los bordes y despega el contenido del centro */}
      <div
        aria-hidden
        className="absolute inset-0 bg-[radial-gradient(ellipse_at_center,transparent_0%,rgba(11,5,9,0.6)_50%,rgba(11,5,9,0.95)_100%)]"
      />

      <div className="relative w-full max-w-4xl text-center">
        {/* BIENVENIDA — el bloque de presentación */}
        <div className="relative portal-rise" style={{ animationDelay: "0.05s" }}>
          {/* Resplandor rosa latiendo detrás del título */}
          <div
            aria-hidden
            className="portal-glow pointer-events-none absolute left-1/2 top-1/2 -translate-x-1/2 -translate-y-1/2 w-[min(90vw,760px)] h-44 rounded-full bg-[radial-gradient(ellipse,rgba(255,64,129,0.35),transparent_70%)] blur-2xl"
          />

          {/* Destellos alrededor, los mismos que usa la home */}
          <Sparkles
            aria-hidden
            className="absolute -top-2 left-[8%] sm:left-[16%] w-5 h-5 text-rose-primary sparkle-twinkle pointer-events-none"
          />
          <Sparkles
            aria-hidden
            className="absolute top-1/2 right-[6%] sm:right-[14%] w-4 h-4 text-rose-deep sparkle-twinkle pointer-events-none"
            style={{ animationDelay: "0.8s" }}
          />
          <Sparkles
            aria-hidden
            className="absolute -bottom-1 left-[22%] w-3 h-3 text-rose-medium sparkle-twinkle pointer-events-none"
            style={{ animationDelay: "1.6s" }}
          />

          <h1 className="bienvenida-text relative font-display text-4xl sm:text-6xl lg:text-7xl font-bold uppercase tracking-[0.12em] sm:tracking-[0.18em] leading-none">
            Bienvenida
          </h1>
        </div>

        {/* La animación de entrada va en el wrapper y el flote en el título:
            si compartieran elemento, las dos pelearían por el mismo transform. */}
        <div className="portal-rise relative mt-6" style={{ animationDelay: "0.25s" }}>
          <h2 className="portal-float font-display text-3xl sm:text-5xl lg:text-6xl font-semibold text-white leading-[1.05] drop-shadow-[0_2px_30px_rgba(0,0,0,0.7)]">
            ¿Dónde querés comprar?
          </h2>
        </div>
        <p
          className="portal-rise text-white/55 mt-3 mb-10 sm:mb-12 max-w-lg mx-auto text-sm sm:text-base"
          style={{ animationDelay: "0.4s" }}
        >
          Elegí tu tienda para ver los productos y los envíos de tu zona.
        </p>

        <div className="grid gap-5 sm:gap-6 sm:grid-cols-2">
          {stores.map((store, i) => {
            const entrando = pending === store.id;
            return (
              // El wrapper lleva la animación de entrada: si la llevara el botón,
              // el transform final de portal-rise (fill-mode: forwards) pisaría
              // el hover:-translate-y-2 y las tarjetas no se levantarían.
              <div
                key={store.id}
                className="portal-rise"
                style={{ animationDelay: `${0.55 + i * 0.12}s` }}
              >
              <button
                type="button"
                onClick={() => pick(store)}
                disabled={pending !== null}
                aria-label={`Entrar a ${store.name}`}
                className="group relative w-full h-full flex flex-col items-center gap-5 rounded-[2rem] border border-white/12 bg-white/[0.04] backdrop-blur-2xl p-6 sm:p-8 transition duration-300 hover:-translate-y-2 hover:border-rose-primary/70 hover:bg-white/[0.07] hover:shadow-[0_0_50px_-8px_rgba(255,143,163,0.55)] focus-visible:outline-none focus-visible:ring-4 focus-visible:ring-rose-primary/40 disabled:opacity-60 disabled:hover:translate-y-0"
              >
                {/* Brillo superior: da volumen al vidrio */}
                <span
                  aria-hidden
                  className="pointer-events-none absolute inset-x-0 top-0 h-px bg-gradient-to-r from-transparent via-white/40 to-transparent"
                />
                {/* Halo rosa que se enciende al pasar por encima */}
                <span
                  aria-hidden
                  className="pointer-events-none absolute -inset-px rounded-[2rem] opacity-0 group-hover:opacity-100 transition duration-500 bg-[radial-gradient(circle_at_50%_0%,rgba(255,143,163,0.22),transparent_65%)]"
                />

                {store.logoUrl && (
                  // eslint-disable-next-line @next/next/no-img-element
                  <img
                    src={store.logoUrl}
                    alt={store.name}
                    width={800}
                    height={800}
                    className="relative h-36 sm:h-44 lg:h-52 w-auto object-contain transition duration-500 group-hover:scale-[1.07] drop-shadow-[0_0_35px_rgba(255,143,163,0.35)]"
                  />
                )}

                <div className="relative flex items-center gap-2">
                  <MapPin className="w-5 h-5 text-rose-primary" />
                  <span className="font-display text-base sm:text-lg uppercase tracking-[0.18em] text-white">
                    {store.shortName}
                  </span>
                </div>

                {/* Botón neón */}
                <span className="relative w-full flex items-center justify-center gap-2.5 rounded-full border border-rose-primary/80 bg-gradient-to-r from-rose-deep to-rose-primary px-5 py-3 font-semibold uppercase tracking-[0.22em] text-sm text-white shadow-[0_0_18px_rgba(255,143,163,0.55),inset_0_1px_0_rgba(255,255,255,0.35)] transition duration-300 group-hover:shadow-[0_0_28px_rgba(255,143,163,0.9),0_0_60px_rgba(230,107,133,0.5),inset_0_1px_0_rgba(255,255,255,0.5)]">
                  {entrando ? "Entrando…" : "Entrar"}
                  {!entrando && (
                    <ArrowRight className="w-4 h-4 transition group-hover:translate-x-1" />
                  )}
                </span>
              </button>
              </div>
            );
          })}
        </div>
      </div>
    </main>
  );
}
