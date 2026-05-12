import Link from "next/link";
import type { Product } from "@cancerianas/shared";
import { formatPrice } from "@cancerianas/shared";

export default function ProductCard({ product }: { product: Product }) {
  const hasDiscount = product.compare_price && product.compare_price > product.price;
  const discountPct = hasDiscount
    ? Math.round((1 - product.price / product.compare_price!) * 100)
    : 0;
  const soldOut = product.stock <= 0;

  return (
    <Link
      href={`/product/${product.slug}`}
      className={`group block rounded-3xl bg-white overflow-hidden shadow-soft transition-all duration-300 ${
        soldOut ? "opacity-60" : "hover:shadow-lift hover:-translate-y-1"
      }`}
    >
      <div className="relative aspect-square bg-rose-pastel overflow-hidden">
        {product.images[0] ? (
          <img
            src={product.images[0]}
            alt={product.name}
            className={`w-full h-full object-cover transition-transform duration-500 ${
              soldOut ? "grayscale" : "group-hover:scale-105"
            }`}
          />
        ) : (
          <div className="w-full h-full flex items-center justify-center text-rose-medium text-6xl font-display">
            🌸
          </div>
        )}
        {soldOut ? (
          <span className="absolute top-3 left-3 bg-ink-soft text-white text-xs font-bold px-3 py-1 rounded-full">
            Sin stock
          </span>
        ) : (
          <>
            {hasDiscount && (
              <span className="absolute top-3 right-3 bg-rose-deep text-white text-xs font-bold px-3 py-1 rounded-full">
                -{discountPct}%
              </span>
            )}
            {product.stock <= 3 && (
              <span className="absolute top-3 left-3 bg-warning/90 text-ink-primary text-xs font-bold px-3 py-1 rounded-full">
                Últimas {product.stock}
              </span>
            )}
          </>
        )}
      </div>
      <div className="p-4">
        <h3
          className={`font-display text-lg text-ink-primary leading-tight mb-1 line-clamp-2 ${
            soldOut ? "line-through text-ink-soft" : ""
          }`}
        >
          {product.name}
        </h3>
        <div className="flex items-baseline gap-2 mt-2">
          <span className="font-bold text-rose-deep text-lg">{formatPrice(product.price)}</span>
          {hasDiscount && (
            <span className="text-ink-soft text-sm line-through">{formatPrice(product.compare_price!)}</span>
          )}
        </div>
      </div>
    </Link>
  );
}
