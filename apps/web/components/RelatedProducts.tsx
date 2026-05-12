"use client";

import { useRef } from "react";
import { ChevronLeft, ChevronRight } from "lucide-react";
import Link from "next/link";
import type { Product } from "@cancerianas/shared";
import { formatPrice } from "@cancerianas/shared";

export default function RelatedProducts({ products }: { products: Product[] }) {
  const scrollRef = useRef<HTMLDivElement>(null);

  if (products.length === 0) return null;

  const CARD_W = 264; // ~card width + gap

  function scroll(dir: "left" | "right") {
    scrollRef.current?.scrollBy({ left: dir === "left" ? -CARD_W * 2 : CARD_W * 2, behavior: "smooth" });
  }

  return (
    <section className="bg-rose-whisper py-14">
      <div className="max-w-6xl mx-auto px-4">
        <h2 className="font-display font-black text-3xl md:text-4xl text-ink-primary text-center uppercase tracking-widest mb-8">Productos similares</h2>

        <div className="relative">
          {/* Left arrow */}
          <button
            onClick={() => scroll("left")}
            className="absolute left-0 top-1/2 -translate-y-1/2 -translate-x-4 z-10 w-10 h-10 bg-white rounded-full shadow-soft flex items-center justify-center hover:shadow-lift transition"
            aria-label="Anterior"
          >
            <ChevronLeft className="w-5 h-5 text-ink-primary" />
          </button>

          {/* Carousel */}
          <div
            ref={scrollRef}
            className="flex gap-4 overflow-x-auto scroll-smooth pb-4 px-2"
            style={{ scrollbarWidth: "none" }}
          >
            {products.map((product) => {
              const hasDiscount = product.compare_price && product.compare_price > product.price;
              const discountPct = hasDiscount
                ? Math.round((1 - product.price / product.compare_price!) * 100)
                : 0;
              const soldOut = product.stock <= 0;

              return (
                <Link
                  key={product.id}
                  href={`/product/${product.slug}`}
                  className="group flex-shrink-0 w-56 bg-white rounded-3xl overflow-hidden shadow-soft hover:shadow-lift hover:-translate-y-1 transition-all duration-300"
                >
                  <div className="relative aspect-square bg-rose-pastel overflow-hidden">
                    {product.images[0] ? (
                      <img
                        src={product.images[0]}
                        alt={product.name}
                        className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-500"
                      />
                    ) : (
                      <div className="w-full h-full flex items-center justify-center text-5xl">🌸</div>
                    )}

                    {soldOut && (
                      <span className="absolute top-2 left-2 bg-ink-soft text-white text-xs font-bold px-2 py-0.5 rounded-full">
                        Sin stock
                      </span>
                    )}
                    {!soldOut && hasDiscount && (
                      <span className="absolute top-2 right-2 bg-rose-deep text-white text-xs font-bold px-2 py-0.5 rounded-full">
                        -{discountPct}%
                      </span>
                    )}
                    {!soldOut && product.stock <= 3 && (
                      <span className="absolute top-2 left-2 bg-warning/90 text-ink-primary text-xs font-bold px-2 py-0.5 rounded-full">
                        Últimas {product.stock}
                      </span>
                    )}
                  </div>

                  <div className="p-3">
                    <p className="font-display text-sm text-ink-primary leading-snug line-clamp-2 mb-2">
                      {product.name}
                    </p>
                    <div className="flex items-baseline gap-1.5">
                      <span className="font-bold text-rose-deep">{formatPrice(product.price)}</span>
                      {hasDiscount && (
                        <span className="text-ink-soft text-xs line-through">
                          {formatPrice(product.compare_price!)}
                        </span>
                      )}
                    </div>
                  </div>
                </Link>
              );
            })}
          </div>

          {/* Right arrow */}
          <button
            onClick={() => scroll("right")}
            className="absolute right-0 top-1/2 -translate-y-1/2 translate-x-4 z-10 w-10 h-10 bg-white rounded-full shadow-soft flex items-center justify-center hover:shadow-lift transition"
            aria-label="Siguiente"
          >
            <ChevronRight className="w-5 h-5 text-ink-primary" />
          </button>
        </div>
      </div>
    </section>
  );
}
