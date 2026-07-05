import Link from "next/link";
import type { Product } from "@cancerianas/shared";
import { formatPrice } from "@cancerianas/shared";
import QuickAddButton from "./QuickAddButton";

// Card glam de la vitrina oscura de la home: tile de foto blanco flotando
// sobre vidrio esmerilado, precio en degradé rosa y el "+" superpuesto a la
// foto. La tienda sigue usando ProductCard (tema claro).
export default function ProductCardGlam({ product }: { product: Product }) {
  const hasDiscount = product.compare_price && product.compare_price > product.price;
  const discountPct = hasDiscount
    ? Math.round((1 - product.price / product.compare_price!) * 100)
    : 0;
  const savings = hasDiscount ? product.compare_price! - product.price : 0;
  const soldOut = product.stock <= 0;
  const hasVariants =
    Array.isArray((product as any).variants) && (product as any).variants.length > 0;

  return (
    <Link
      href={`/product/${product.slug}`}
      className={`group relative block rounded-[1.6rem] p-2.5 pb-4 bg-white/[0.05] backdrop-blur-md border border-white/10 transition-all duration-300 ${
        soldOut
          ? "opacity-50"
          : "hover:border-rose-primary/50 hover:-translate-y-1.5 hover:shadow-[0_24px_60px_-15px_rgba(255,143,163,0.45)]"
      }`}
    >
      {/* Tile de imagen + botón flotante */}
      <div className="relative">
        <div className="relative aspect-square rounded-[1.15rem] overflow-hidden bg-white">
          {product.images[0] ? (
            <img
              src={product.images[0]}
              alt={product.name}
              className={`w-full h-full object-cover transition-transform duration-700 ease-out ${
                soldOut ? "grayscale" : "group-hover:scale-110"
              }`}
            />
          ) : (
            <div className="w-full h-full flex items-center justify-center bg-rose-whisper text-6xl">
              🌸
            </div>
          )}

          {/* Badges dentro del tile */}
          {soldOut ? (
            <span className="absolute top-2.5 left-2.5 bg-black/70 backdrop-blur text-white/90 text-[10px] font-black px-2.5 py-1 rounded-full uppercase tracking-wider">
              Sin stock
            </span>
          ) : (
            <>
              {hasDiscount && (
                <span className="absolute top-2.5 left-2.5 bg-gradient-to-br from-rose-deep to-rose-primary text-white text-xs font-black px-2.5 py-1 rounded-full shadow-lg">
                  −{discountPct}%
                </span>
              )}
              {product.stock <= 3 && product.stock > 0 && (
                <span className="absolute bottom-2.5 left-2.5 bg-ink-primary/85 backdrop-blur text-white text-[10px] font-black px-2.5 py-1 rounded-full uppercase tracking-wider flex items-center gap-1.5">
                  <span className="w-1.5 h-1.5 bg-rose-primary rounded-full animate-pulse" />
                  Últimas {product.stock}
                </span>
              )}
            </>
          )}
        </div>

        {/* "+" superpuesto al borde inferior del tile */}
        {!soldOut && (
          <QuickAddButton
            productId={product.id}
            productSlug={product.slug}
            price={product.price}
            hasVariants={hasVariants}
            className="absolute -bottom-4 right-2.5 z-10 shadow-[0_8px_24px_rgba(230,107,133,0.55)]"
          />
        )}
      </div>

      {/* Info */}
      <div className="px-1.5 pt-4">
        <h3
          className={`font-sans font-semibold text-[15px] leading-snug line-clamp-2 min-h-[2.6rem] pr-8 transition-colors ${
            soldOut
              ? "line-through text-white/40"
              : "text-white group-hover:text-rose-medium"
          }`}
        >
          {product.name}
        </h3>
        <div className="flex items-baseline gap-2 flex-wrap mt-1.5">
          <span className="text-xl font-black tracking-tight bg-gradient-to-r from-rose-primary via-rose-medium to-rose-primary bg-clip-text text-transparent">
            {formatPrice(product.price)}
          </span>
          {hasDiscount && (
            <span className="text-white/35 text-xs line-through tabular-nums">
              {formatPrice(product.compare_price!)}
            </span>
          )}
        </div>
        {hasDiscount && (
          <span className="inline-block mt-1.5 text-[10px] font-bold text-success bg-success/15 border border-success/25 px-2 py-0.5 rounded-full uppercase tracking-wider">
            Ahorrás {formatPrice(savings)}
          </span>
        )}
      </div>
    </Link>
  );
}
