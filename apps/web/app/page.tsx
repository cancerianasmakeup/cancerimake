import Link from "next/link";
import { ArrowRight, Sparkles, Heart, Truck } from "lucide-react";
import { createSupabaseServer } from "@/lib/supabase-server";
import Header from "@/components/Header";
import Footer from "@/components/Footer";
import ProductCard from "@/components/ProductCard";
import AdminPreviewBanner from "@/components/AdminPreviewBanner";
import DropCountdownStrip from "@/components/DropCountdownStrip";
import BannerCarousel from "@/components/BannerCarousel";
import { getServerStoreState, isCurrentUserAdmin } from "@/lib/store-status";
import type { Product, Category, LiveEvent } from "@cancerianas/shared";

// Tienda de oportunidades: el estado depende del momento → NO cachear el HTML
export const dynamic = "force-dynamic";

export default async function HomePage() {
  const [{ status }, isAdmin] = await Promise.all([
    getServerStoreState(),
    isCurrentUserAdmin(),
  ]);
  return (
    <>
      {!status.isOpen && isAdmin && <AdminPreviewBanner />}
      <HomeOpen />
    </>
  );
}

async function HomeOpen() {
  const supabase = await createSupabaseServer();

  const [{ data: featured }, { data: categories }, { data: liveEvents }] = await Promise.all([
    supabase
      .from("products")
      .select("*")
      .eq("status", "active")
      .order("created_at", { ascending: false })
      .limit(50),
    supabase
      .from("categories")
      .select("*")
      .eq("is_active", true)
      .order("display_order"),
    supabase
      .from("live_events")
      .select("*")
      .in("status", ["active", "draft"])
      .order("created_at", { ascending: false })
      .limit(3),
  ]);

  const activeLive = (liveEvents as LiveEvent[] | null)?.find(e => e.status === "active");

  return (
    <>
      <Header />
      <DropCountdownStrip />

      {/* HERO — full viewport con carrusel flotante */}
      <section className="relative overflow-hidden min-h-[80dvh] flex items-start">
        {/* Video fondo */}
        <video
          autoPlay
          loop
          muted
          playsInline
          preload="none"
          className="absolute inset-0 w-full h-full object-cover pointer-events-none"
          src="https://pub-4ee8d6afe02b441fa29b28b501f5a6be.r2.dev/hero-bg.mp4"
        />
        {/* Overlay */}
        <div className="absolute inset-0 bg-gradient-to-br from-white/85 via-white/50 to-white/10" />

        <div className="relative w-full max-w-6xl mx-auto px-4 pt-8 pb-16 md:pt-10 md:pb-24 space-y-8">

          {/* Logo + bienvenida */}
          <div className="flex items-center justify-center gap-3 min-w-0">
            <img
              src="https://pub-4ee8d6afe02b441fa29b28b501f5a6be.r2.dev/logo%20solo%20(1).png"
              alt="Cancerianas"
              className="h-14 md:h-20 w-auto object-contain drop-shadow-md shrink-0"
            />
            <p
              className="font-display font-black italic tracking-tight leading-none drop-shadow-sm"
              style={{
                fontSize: "clamp(1.6rem, 9vw, 4rem)",
                background: "linear-gradient(135deg, #F06292 0%, #EC407A 50%, #FF80AB 100%)",
                WebkitBackgroundClip: "text",
                WebkitTextFillColor: "transparent",
                backgroundClip: "text",
              }}
            >
              BIENVENIDA
            </p>
          </div>

          {/* Carrusel — un poco más chico, centrado */}
          <div className="w-full max-w-3xl mx-auto rounded-[2rem] overflow-hidden shadow-[0_32px_80px_-12px_rgba(0,0,0,0.28)] ring-1 ring-white/40">
            <BannerCarousel />
          </div>

          {/* Texto hero — siempre centrado horizontalmente */}
          <div className="max-w-2xl mx-auto space-y-6 text-center">
            <h1 className="font-display text-[clamp(2rem,9vw,5rem)] md:text-7xl leading-[1.05] text-ink-primary drop-shadow-sm font-black md:whitespace-nowrap">
              TU LUGAR,
              <span className="block italic text-rose-deep">NUESTRO LUGAR.</span>
            </h1>
            <p className="text-lg text-ink-secondary leading-relaxed max-w-md mx-auto">
              Un lugar para todas, para que todo sea más fácil y más cómodo. Acá van a estar desde las dinámicas hasta los envíos. Acá va a estar todo.
            </p>
            <div className="flex flex-wrap gap-3 justify-center">
              <Link href="/shop" className="btn-primary">
                Ver tienda <ArrowRight className="w-4 h-4" />
              </Link>
              {activeLive && (
                <Link href={`/live/${activeLive.id}`} className="btn-secondary">
                  <span className="w-2 h-2 bg-rose-deep rounded-full animate-pulse" />
                  LIVE en curso
                </Link>
              )}
            </div>
            <div className="flex gap-6 pt-2 text-sm text-ink-secondary justify-center">
              <div className="flex items-center gap-2">
                <Truck className="w-4 h-4 text-rose-deep" /> Envíos a todo el país
              </div>
              <div className="flex items-center gap-2">
                <Heart className="w-4 h-4 text-rose-deep" /> Hecho con amor
              </div>
            </div>
          </div>

        </div>
      </section>

      {/* TIKTOK BANNER — logo sticker grande + card pegada a la derecha */}
      <section className="max-w-6xl mx-auto px-4 mt-8 mb-4">
        <a
          href="https://www.tiktok.com/@cancerianas.makeup2"
          target="_blank"
          rel="noopener noreferrer"
          aria-label="Seguinos en TikTok @cancerianas.makeup2"
          className="group flex flex-col md:flex-row items-center justify-center gap-4 md:gap-0 hover:scale-[1.01] transition-transform active:scale-100"
        >
          {/* Logo sticker — grande, recortado, ligeramente rotado, con sombra fuerte */}
          <div
            className="relative z-10 shrink-0 -mb-6 md:mb-0 md:-mr-8 md:-rotate-6 group-hover:md:-rotate-3 transition-transform duration-300"
            style={{ filter: "drop-shadow(0 18px 28px rgba(0,0,0,0.35))" }}
          >
            <svg
              viewBox="0 0 24 24"
              xmlns="http://www.w3.org/2000/svg"
              className="w-28 h-28 md:w-44 md:h-44"
            >
              {/* Capa cyan (atrás, offset arriba-derecha) */}
              <g transform="translate(0.7, -0.7)">
                <path
                  fill="#25F4EE"
                  d="M19.59 6.69a4.83 4.83 0 0 1-3.77-4.25V2h-3.45v13.67a2.89 2.89 0 0 1-2.88 2.5 2.89 2.89 0 0 1-2.89-2.89 2.89 2.89 0 0 1 2.89-2.89c.28 0 .54.04.79.1V9.01a6.33 6.33 0 0 0-.79-.05 6.34 6.34 0 0 0-6.34 6.34 6.34 6.34 0 0 0 6.34 6.34 6.34 6.34 0 0 0 6.33-6.34V8.69a8.18 8.18 0 0 0 4.78 1.52V6.78a4.85 4.85 0 0 1-1.01-.09z"
                />
              </g>
              {/* Capa rosa (atrás, offset abajo-izquierda) */}
              <g transform="translate(-0.7, 0.7)">
                <path
                  fill="#FE2C55"
                  d="M19.59 6.69a4.83 4.83 0 0 1-3.77-4.25V2h-3.45v13.67a2.89 2.89 0 0 1-2.88 2.5 2.89 2.89 0 0 1-2.89-2.89 2.89 2.89 0 0 1 2.89-2.89c.28 0 .54.04.79.1V9.01a6.33 6.33 0 0 0-.79-.05 6.34 6.34 0 0 0-6.34 6.34 6.34 6.34 0 0 0 6.34 6.34 6.34 6.34 0 0 0 6.33-6.34V8.69a8.18 8.18 0 0 0 4.78 1.52V6.78a4.85 4.85 0 0 1-1.01-.09z"
                />
              </g>
              {/* Nota principal blanca (al frente) */}
              <path
                fill="white"
                d="M19.59 6.69a4.83 4.83 0 0 1-3.77-4.25V2h-3.45v13.67a2.89 2.89 0 0 1-2.88 2.5 2.89 2.89 0 0 1-2.89-2.89 2.89 2.89 0 0 1 2.89-2.89c.28 0 .54.04.79.1V9.01a6.33 6.33 0 0 0-.79-.05 6.34 6.34 0 0 0-6.34 6.34 6.34 6.34 0 0 0 6.34 6.34 6.34 6.34 0 0 0 6.33-6.34V8.69a8.18 8.18 0 0 0 4.78 1.52V6.78a4.85 4.85 0 0 1-1.01-.09z"
                stroke="#000"
                strokeWidth="0.3"
              />
            </svg>
          </div>

          {/* Card a la derecha — pegada al logo */}
          <div className="relative w-full md:w-auto rounded-3xl bg-[#010101] text-white shadow-2xl overflow-hidden">
            {/* Glows decorativos */}
            <div className="absolute -top-10 -left-10 w-40 h-40 bg-[#25F4EE] opacity-25 rounded-full blur-3xl pointer-events-none" />
            <div className="absolute -bottom-10 -right-10 w-40 h-40 bg-[#FE2C55] opacity-25 rounded-full blur-3xl pointer-events-none" />

            <div className="relative px-6 py-5 md:pl-16 md:pr-8 md:py-7 flex flex-col md:flex-row items-center gap-4 md:gap-8 text-center md:text-left">
              <div>
                <p className="text-[11px] uppercase tracking-[0.2em] font-bold text-[#25F4EE]">
                  Tu pase al backstage
                </p>
                <p className="font-display text-2xl md:text-3xl font-black tracking-tight mt-1 leading-none">
                  @cancerianas.makeup2
                </p>
                <p className="text-white/60 text-sm font-medium mt-1.5">
                  Drops, dinámicas y LIVES en TikTok
                </p>
              </div>
              <span className="inline-flex items-center gap-2 bg-white text-[#010101] rounded-full px-6 py-3 font-black text-sm tracking-wide shadow-lg shrink-0 group-hover:gap-3 transition-all">
                Seguir
                <span className="inline-block group-hover:translate-x-1 transition-transform">→</span>
              </span>
            </div>
          </div>
        </a>
      </section>

      {/* LIVE TEASER */}
      <section className="max-w-6xl mx-auto px-4 mt-10 mb-10">
        <div className="rounded-[2.5rem] bg-gradient-to-br from-rose-deep via-rose-primary to-rose-medium p-10 md:p-16 text-white relative overflow-hidden">
          <div className="absolute top-0 right-0 text-[20rem] opacity-10 -mr-20 -mt-20 leading-none">🌸</div>
          <div className="relative max-w-2xl">
            <span className="badge-live mb-4">
              {activeLive ? "EN VIVO AHORA" : "PRÓXIMAMENTE"}
            </span>
            <h2 className="font-display text-4xl md:text-6xl mb-4 leading-tight">
              Las dinámicas en vivo más esperadas.
            </h2>
            <p className="text-white/90 text-lg mb-8">
              Cápsulas, sobres, bolsitas. Mientras hago el LIVE en TikTok, vos comprás acá con lugar reservado y pago seguro.
            </p>
            <Link
              href={activeLive ? `/live/${activeLive.id}` : "/live"}
              className="inline-flex items-center gap-2 bg-white text-rose-deep px-8 py-4 rounded-full font-bold hover:scale-105 transition-transform"
            >
              {activeLive ? "Entrar al LIVE" : "Ver próximos eventos"}
              <ArrowRight className="w-5 h-5" />
            </Link>
          </div>
        </div>
      </section>

      {/* CATEGORÍAS */}
      <section className="max-w-6xl mx-auto px-4 mt-12 mb-16">
        <h2 className="font-sans text-2xl font-black tracking-tight mb-8 text-center uppercase">
          <span className="text-ink-primary">Elegí lo que </span><span className="text-rose-deep">buscas</span>
        </h2>
        <div className="grid grid-cols-2 md:grid-cols-4 gap-3 md:gap-5">
          {(categories as Category[] | null)?.map((cat) => {
            const from = cat.gradient_from || "#FFE5EC";
            const to = cat.gradient_to || "#FFB3C6";
            return (
              <Link
                key={cat.id}
                href={`/category/${cat.slug}`}
                aria-label={cat.name}
                className="relative aspect-square rounded-3xl overflow-hidden shadow-soft hover:shadow-lift transition-all hover:-translate-y-1 group"
                style={
                  cat.image_url
                    ? {
                        backgroundImage: `url(${cat.image_url})`,
                        backgroundSize: "cover",
                        backgroundPosition: "center",
                      }
                    : {
                        background: `radial-gradient(circle at 25% 20%, ${from}, ${to} 75%)`,
                      }
                }
              >
                {!cat.image_url && (
                  <div className="absolute top-3 left-3 md:top-4 md:left-4 w-10 h-10 md:w-12 md:h-12 rounded-full bg-white/95 backdrop-blur flex items-center justify-center shadow-md ring-1 ring-black/5 group-hover:scale-110 transition-transform">
                    <span className="text-xl md:text-2xl leading-none">{cat.icon || "🌸"}</span>
                  </div>
                )}
                <h3 className="absolute bottom-3 left-3 md:bottom-4 md:left-4 font-sans text-sm md:text-base font-bold text-white tracking-tight leading-none drop-shadow-[0_2px_4px_rgba(0,0,0,0.5)]">
                  {cat.name}
                </h3>
              </Link>
            );
          })}
        </div>
      </section>

      {/* DESTACADOS */}
      <section className="mb-16">
        <div className="max-w-6xl mx-auto px-4 mb-6">
          <h2 className="font-sans text-2xl font-black tracking-tight uppercase text-center">
            <span className="text-ink-primary">Todos nuestros </span><span className="text-rose-deep">productos</span>
          </h2>
        </div>
        {(featured as Product[] | null)?.length ? (
          <div className="flex gap-4 overflow-x-auto snap-x snap-mandatory scroll-smooth px-4 pb-4 scrollbar-hide"
            style={{ scrollPaddingLeft: "1rem" }}>
            {(featured as Product[]).map((p) => (
              <div key={p.id} className="snap-start shrink-0 w-[70vw] max-w-[260px]">
                <ProductCard product={p} />
              </div>
            ))}
            {/* Ver todo al final del carrusel */}
            <div className="snap-start shrink-0 w-[45vw] max-w-[180px] flex items-center justify-center">
              <Link href="/shop" className="btn-primary flex-col gap-2 h-full min-h-[220px] rounded-3xl w-full justify-center text-center">
                <ArrowRight className="w-6 h-6" />
                Ver todo
              </Link>
            </div>
          </div>
        ) : (
          <div className="card text-center py-16 mx-4">
            <div className="text-6xl mb-4">🌸</div>
            <p className="text-ink-secondary">Todavía no hay productos destacados.</p>
            <p className="text-ink-soft text-sm mt-2">Agregá productos desde el panel admin y marcalos como destacados.</p>
          </div>
        )}
      </section>

      <Footer />
    </>
  );
}
