"use client";

import { useEffect, useRef, useState } from "react";
import { ChevronLeft, ChevronRight } from "lucide-react";

const BANNERS = [
  "https://pub-4ee8d6afe02b441fa29b28b501f5a6be.r2.dev/BANNER/10K%20CANCERIANAS.png",
  "https://pub-4ee8d6afe02b441fa29b28b501f5a6be.r2.dev/BANNER/GRACIASPAISES.png",
  "https://pub-4ee8d6afe02b441fa29b28b501f5a6be.r2.dev/BANNER/IMDEESPECTADORES.png",
  "https://pub-4ee8d6afe02b441fa29b28b501f5a6be.r2.dev/BANNER/NUESTRATIENDAINFO.png",
];

const INTERVAL = 4000;

export default function BannerCarousel() {
  const [current, setCurrent] = useState(0);
  const timerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  function go(idx: number) {
    setCurrent((idx + BANNERS.length) % BANNERS.length);
  }

  function reset() {
    if (timerRef.current) clearInterval(timerRef.current);
    timerRef.current = setInterval(() => setCurrent((c) => (c + 1) % BANNERS.length), INTERVAL);
  }

  useEffect(() => {
    reset();
    return () => { if (timerRef.current) clearInterval(timerRef.current); };
  }, []);

  function prev() { go(current - 1); reset(); }
  function next() { go(current + 1); reset(); }

  return (
    <div className="relative w-full overflow-hidden select-none">
      {/* Slides */}
      <div
        className="flex transition-transform duration-500 ease-in-out"
        style={{ transform: `translateX(-${current * 100}%)` }}
      >
        {BANNERS.map((src, i) => (
          <div key={i} className="min-w-full">
            <img
              src={src}
              alt={`Banner ${i + 1}`}
              className="w-full h-auto object-cover"
              draggable={false}
            />
          </div>
        ))}
      </div>

      {/* Flechas */}
      <button
        onClick={prev}
        className="absolute left-3 top-1/2 -translate-y-1/2 bg-white/70 hover:bg-white backdrop-blur-sm rounded-full p-2 shadow transition"
        aria-label="Anterior"
      >
        <ChevronLeft className="w-5 h-5 text-ink-primary" />
      </button>
      <button
        onClick={next}
        className="absolute right-3 top-1/2 -translate-y-1/2 bg-white/70 hover:bg-white backdrop-blur-sm rounded-full p-2 shadow transition"
        aria-label="Siguiente"
      >
        <ChevronRight className="w-5 h-5 text-ink-primary" />
      </button>

      {/* Dots */}
      <div className="absolute bottom-3 left-1/2 -translate-x-1/2 flex gap-2">
        {BANNERS.map((_, i) => (
          <button
            key={i}
            onClick={() => { go(i); reset(); }}
            className={`rounded-full transition-all ${i === current ? "w-5 h-2 bg-rose-deep" : "w-2 h-2 bg-white/70"}`}
          />
        ))}
      </div>
    </div>
  );
}
