import Link from "next/link";
import type { Product } from "@cancerianas/shared";
import { formatPrice } from "@cancerianas/shared";
import { ArrowUpRight } from "lucide-react";

export default function ProductCard({ product }: { product: Product }) {
  const hasDiscount = product.compare_price && product.compare_price > product.price;
  const discountPct = hasDiscount
    ? Math.round((1 - product.price / product.compare_price!) * 100)
    : 0;
  const savings = hasDiscount ? product.compare_price! - product.price : 0;
  const soldOut = product.stock <= 0;

  return (
    <Link
      href={`/product/${product.slug}`}
      className={`group relative block rounded-3xl bg-white overflow-hidden border border-rose-pastel/50 transition-all duration-300 ${
        soldOut
          ? "opacity-60"
          : "shadow-[0_2px_12px_-4px_rgba(255,143,163,0.18)] hover:shadow-[0_20px_40px_-12px_rgba(230,107,133,0.35)] hover:-translate-y-1.5 hover:border-rose-primary/40"
      }`}
    >
      {/* Imagen con zoom + overlay reveal */}
      <div className="relative aspect-square bg-rose-pastel overflow-hidden">
        {product.images[0] ? (
          <img
            src={product.images[0]}
            alt={product.name}
            className={`w-full h-full object-cover transition-transform duration-700 ease-out ${
              soldOut ? "grayscale" : "group-hover:scale-110"
            }`}
          />
        ) : (
          <div className="w-full h-full flex items-center justify-center text-rose-medium text-6xl font-display">
            🌸
          </div>
        )}

        {/* Gradient overlay que aparece en hover */}
        {!soldOut && (
          <div className="absolute inset-0 bg-gradient-to-t from-black/40 via-transparent to-transparent opacity-0 group-hover:opacity-100 transition-opacity duration-300 pointer-events-none" />
        )}

        {/* CTA "Ver" que sube en hover */}
        {!soldOut && (
          <div className="absolute bottom-3 left-3 right-3 flex items-center justify-between opacity-0 translate-y-3 group-hover:opacity-100 group-hover:translate-y-0 transition-all duration-300">
            <span className="bg-white/95 backdrop-blur text-ink-primary text-xs font-bold px-3 py-1.5 rounded-full shadow-md">
              Ver producto
            </span>
            <span className="w-8 h-8 rounded-full bg-rose-deep text-white flex items-center justify-center shadow-lg">
              <ArrowUpRight className="w-4 h-4" />
            </span>
          </div>
        )}

        {/* Badges esquinas */}
        {soldOut ? (
          <span className="absolute top-3 left-3 bg-ink-soft/95 backdrop-blur text-white text-[10px] font-black px-2.5 py-1 rounded-full uppercase tracking-wider">
            Sin stock
          </span>
        ) : (
          <>
            {hasDiscount && (
              <span className="absolute top-3 right-3 bg-gradient-to-br from-rose-deep to-rose-primary text-white text-xs font-black px-2.5 py-1 rounded-full shadow-md ring-2 ring-white/40">
                −{discountPct}%
              </span>
            )}
            {product.stock <= 3 && product.stock > 0 && (
              <span className="absolute top-3 left-3 bg-warning/95 backdrop-blur text-ink-primary text-[10px] font-black px-2.5 py-1 rounded-full uppercase tracking-wider flex items-center gap-1">
                <span className="w-1.5 h-1.5 bg-ink-primary rounded-full animate-pulse" />
                Últimas {product.stock}
              </span>
            )}
          </>
        )}
      </div>

      {/* Info */}
      <div className="p-4">
        <h3
          className={`font-sans font-semibold text-[15px] text-ink-primary leading-snug mb-2 line-clamp-2 min-h-[2.6rem] group-hover:text-rose-deep transition-colors ${
            soldOut ? "line-through text-ink-soft" : ""
          }`}
        >
          {product.name}
        </h3>
        <div className="flex items-baseline justify-between gap-2 mt-1">
          <div className="flex items-baseline gap-2 min-w-0">
            <span className="font-black text-rose-deep text-lg tracking-tight">{formatPrice(product.price)}</span>
            {hasDiscount && (
              <span className="text-ink-soft text-xs line-through tabular-nums">{formatPrice(product.compare_price!)}</span>
            )}
          </div>
          {hasDiscount && (
            <span className="text-[10px] font-bold text-success uppercase tracking-wider whitespace-nowrap">
              Ahorrás {formatPrice(savings)}
            </span>
          )}
        </div>
      </div>
    </Link>
  );
}
