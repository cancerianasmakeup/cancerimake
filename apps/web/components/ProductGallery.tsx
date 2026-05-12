"use client";

// Galería del product detail: imagen/video grande + thumbnails clickeables.
// Soporta autoplay/muted/loop para videos (web mobile-first → silenciados).

import { useState } from "react";
import { Play } from "lucide-react";

type MediaItem = { type: "image" | "video"; url: string };

const VIDEO_EXTENSIONS = /\.(mp4|webm|mov|m4v|ogv)(\?.*)?$/i;
function isVideo(url: string): boolean {
  return VIDEO_EXTENSIONS.test(url);
}

export default function ProductGallery({
  images,
  videos = [],
  alt,
}: {
  images: string[];
  videos?: string[];
  alt: string;
}) {
  // Combinar: la primera imagen como portada, después intercalamos video al inicio
  // del bloque secundario para que llame la atención (es contenido más rico).
  const items: MediaItem[] = [
    ...images.map((url) => ({ type: "image" as const, url })),
    ...videos.map((url) => ({ type: "video" as const, url })),
  ];

  const [activeIdx, setActiveIdx] = useState(0);

  if (items.length === 0) {
    return (
      <div className="aspect-square rounded-3xl bg-rose-pastel flex items-center justify-center text-9xl">
        🌸
      </div>
    );
  }

  const active = items[Math.min(activeIdx, items.length - 1)];

  return (
    <div className="space-y-3">
      {/* Stage principal */}
      <div className="aspect-square rounded-3xl overflow-hidden bg-rose-pastel relative">
        {active.type === "video" || isVideo(active.url) ? (
          <video
            key={active.url}
            src={active.url}
            className="w-full h-full object-cover"
            autoPlay
            muted
            loop
            playsInline
            controls
          />
        ) : (
          <img src={active.url} alt={alt} className="w-full h-full object-cover" />
        )}
      </div>

      {/* Thumbnails */}
      {items.length > 1 && (
        <div className="grid grid-cols-5 gap-2 sm:gap-3">
          {items.slice(0, 10).map((item, i) => {
            const isActive = i === activeIdx;
            const showVideoBadge = item.type === "video" || isVideo(item.url);
            return (
              <button
                key={item.url + i}
                type="button"
                onClick={() => setActiveIdx(i)}
                className={`relative aspect-square rounded-xl sm:rounded-2xl overflow-hidden bg-rose-pastel transition ${
                  isActive ? "ring-2 ring-rose-deep" : "hover:opacity-80"
                }`}
                aria-label={showVideoBadge ? "Ver video" : `Ver foto ${i + 1}`}
              >
                {showVideoBadge ? (
                  <>
                    <video
                      src={item.url}
                      className="w-full h-full object-cover"
                      muted
                      playsInline
                      preload="metadata"
                    />
                    <span className="absolute inset-0 flex items-center justify-center bg-black/30">
                      <Play className="w-5 h-5 text-white fill-white" />
                    </span>
                  </>
                ) : (
                  <img src={item.url} alt="" className="w-full h-full object-cover" />
                )}
              </button>
            );
          })}
        </div>
      )}
    </div>
  );
}
