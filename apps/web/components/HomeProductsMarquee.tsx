import type { Product } from "@cancerianas/shared";
import ProductCardGlam from "./ProductCardGlam";

// Marquesina de productos de la home oscura: 3 filas que corren solas
// (izquierda / derecha / izquierda) a velocidades distintas. Cada fila
// duplica su contenido para loopear sin corte y se pausa al pasar el mouse.
// Server component: la animación es CSS pura (ver globals.css).

const ROWS = [
  { dir: "left", duration: "55s" },
  { dir: "right", duration: "70s" },
  { dir: "left", duration: "62s" },
] as const;

export default function HomeProductsMarquee({ products }: { products: Product[] }) {
  // Máximo 36 (12 por fila) para no inflar el DOM: cada fila se duplica.
  const pool = products.slice(0, 36);

  // Reparto round-robin para que cada fila tenga variedad
  const rows: Product[][] = [[], [], []];
  pool.forEach((p, i) => rows[i % 3].push(p));

  return (
    <div className="relative">
      {/* Fundido en los bordes */}
      <div className="pointer-events-none absolute left-0 top-0 bottom-0 w-8 md:w-24 bg-gradient-to-r from-[#0B0509] to-transparent z-10" />
      <div className="pointer-events-none absolute right-0 top-0 bottom-0 w-8 md:w-24 bg-gradient-to-l from-[#0B0509] to-transparent z-10" />

      <div className="space-y-4 md:space-y-5">
        {rows.map((row, r) =>
          row.length === 0 ? null : (
            <div key={r} className="marquee-row overflow-hidden">
              <div
                className="marquee-track flex gap-4 md:gap-5 w-max pr-4 md:pr-5"
                data-dir={ROWS[r].dir}
                style={{ ["--marquee-duration" as string]: ROWS[r].duration } as React.CSSProperties}
              >
                {row.map((p) => (
                  <div key={p.id} className="w-[46vw] sm:w-[240px] md:w-[256px] shrink-0">
                    <ProductCardGlam product={p} />
                  </div>
                ))}
                {/* Copia para el loop infinito */}
                <div aria-hidden className="contents">
                  {row.map((p) => (
                    <div key={`dup-${p.id}`} className="w-[46vw] sm:w-[240px] md:w-[256px] shrink-0">
                      <ProductCardGlam product={p} />
                    </div>
                  ))}
                </div>
              </div>
            </div>
          )
        )}
      </div>
    </div>
  );
}
