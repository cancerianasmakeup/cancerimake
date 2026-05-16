import Link from "next/link";
import { ArrowRight, Sparkles, Heart, Truck, ShoppingBag } from "lucide-react";
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
      .select("*, variants:product_variants(id)")
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

          {/* Logo + bienvenida con FX: cangrejo balanceándose, gradiente animado, sparkles */}
          <div className="relative flex items-center justify-center gap-3 min-w-0">
            {/* Sparkles flotantes alrededor */}
            <Sparkles
              className="absolute -top-4 left-[18%] w-4 h-4 text-rose-deep/70 sparkle-twinkle pointer-events-none"
              aria-hidden
            />
            <Sparkles
              className="absolute top-2 right-[14%] w-3 h-3 text-rose-primary sparkle-twinkle pointer-events-none"
              style={{ animationDelay: "0.7s" }}
              aria-hidden
            />
            <Sparkles
              className="absolute -bottom-3 left-[40%] w-3.5 h-3.5 text-rose-deep/60 sparkle-twinkle pointer-events-none"
              style={{ animationDelay: "1.3s" }}
              aria-hidden
            />
            <Sparkles
              className="absolute -bottom-2 right-[30%] w-2.5 h-2.5 text-rose-primary/80 sparkle-twinkle pointer-events-none"
              style={{ animationDelay: "1.9s" }}
              aria-hidden
            />

            <span
              role="img"
              aria-label="Cangrejito"
              className="crab-rocking inline-block text-5xl md:text-7xl leading-none shrink-0 drop-shadow-md"
              style={{ filter: "drop-shadow(0 4px 8px rgba(230,107,133,0.25))" }}
            >
              🦀
            </span>
            <p
              className="bienvenida-text font-display font-black italic tracking-tight leading-none drop-shadow-sm"
              style={{ fontSize: "clamp(1.6rem, 9vw, 4rem)" }}
            >
              BIENVENIDA
            </p>
          </div>

          {/* Carrusel — un poco más chico, centrado */}
          <div className="w-full max-w-3xl mx-auto rounded-[2rem] overflow-hidden shadow-[0_32px_80px_-12px_rgba(0,0,0,0.28)] ring-1 ring-white/40">
            <BannerCarousel />
          </div>

          {/* Texto hero — siempre centrado horizontalmente */}
          <div className="relative max-w-2xl mx-auto space-y-6 text-center">
            {/* Glow suave detrás del título */}
            <div className="absolute -top-6 left-1/2 -translate-x-1/2 w-3/4 h-32 bg-rose-pastel/50 blur-3xl rounded-full pointer-events-none" aria-hidden />

            <h1 className="relative font-display text-[clamp(2rem,9vw,5rem)] md:text-7xl leading-[1.05] text-ink-primary drop-shadow-sm font-black md:whitespace-nowrap">
              TU LUGAR,
              <span className="block italic text-rose-deep relative">
                NUESTRO LUGAR.
                {/* Subrayado hecho a mano */}
                <svg
                  className="absolute -bottom-1 md:-bottom-2 left-1/2 -translate-x-1/2 w-[88%] h-3 md:h-4 pointer-events-none"
                  viewBox="0 0 300 12"
                  preserveAspectRatio="none"
                  aria-hidden
                >
                  <path
                    d="M4,8 Q80,2 150,5 T296,7"
                    stroke="#FF8FA3"
                    strokeWidth="3"
                    fill="none"
                    strokeLinecap="round"
                    className="hero-underline-path"
                  />
                </svg>
              </span>
            </h1>

            <p className="text-base md:text-lg text-ink-secondary leading-relaxed max-w-md mx-auto">
              Un lugar para todas, para que todo sea más fácil y más cómodo. Acá van a estar desde las dinámicas hasta los envíos. Acá va a estar todo.
            </p>

            <div className="flex flex-wrap gap-3 justify-center">
              <Link href="/shop" className="group relative btn-primary">
                <span className="absolute inset-0 -z-10 rounded-full bg-rose-primary/40 blur-xl opacity-0 group-hover:opacity-100 transition-opacity duration-300" aria-hidden />
                Ver tienda
                <ArrowRight className="w-4 h-4 transition-transform duration-300 group-hover:translate-x-1" />
              </Link>
              {activeLive && (
                <Link href={`/live/${activeLive.id}`} className="btn-secondary">
                  <span className="w-2 h-2 bg-rose-deep rounded-full animate-pulse" />
                  LIVE en curso
                </Link>
              )}
            </div>

            {/* Trust chips */}
            <div className="flex flex-wrap gap-2 justify-center pt-1">
              <span className="inline-flex items-center gap-2 bg-white/70 backdrop-blur-sm border border-rose-pastel rounded-full px-3.5 py-1.5 text-xs md:text-sm text-ink-secondary font-medium shadow-[0_2px_8px_rgba(255,143,163,0.15)]">
                <Truck className="w-3.5 h-3.5 text-rose-deep" /> Envíos a todo el país
              </span>
              <span className="inline-flex items-center gap-2 bg-white/70 backdrop-blur-sm border border-rose-pastel rounded-full px-3.5 py-1.5 text-xs md:text-sm text-ink-secondary font-medium shadow-[0_2px_8px_rgba(255,143,163,0.15)]">
                <Heart className="w-3.5 h-3.5 text-rose-deep" /> Hecho con amor
              </span>
              <span className="inline-flex items-center gap-2 bg-white/70 backdrop-blur-sm border border-rose-pastel rounded-full px-3.5 py-1.5 text-xs md:text-sm text-ink-secondary font-medium shadow-[0_2px_8px_rgba(255,143,163,0.15)]">
                <Sparkles className="w-3.5 h-3.5 text-rose-deep" /> Drops exclusivos
              </span>
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
        <div className="rounded-[2.5rem] bg-gradient-to-br from-rose-deep via-rose-primary to-rose-medium p-6 md:p-12 text-white relative overflow-hidden">
          {/* Decorativos: sparkles + bubbles flotantes */}
          <div className="absolute -top-16 -right-16 w-72 h-72 bg-white/15 rounded-full blur-3xl pointer-events-none" />
          <div className="absolute -bottom-20 -left-20 w-80 h-80 bg-rose-deep/40 rounded-full blur-3xl pointer-events-none" />
          <div className="absolute top-6 right-1/4 w-2 h-2 bg-white rounded-full opacity-60 animate-pulse pointer-events-none" />
          <div className="absolute bottom-10 right-1/3 w-1.5 h-1.5 bg-white rounded-full opacity-50 animate-pulse pointer-events-none" style={{ animationDelay: "0.6s" }} />
          <div className="absolute top-1/3 right-12 w-3 h-3 bg-white rounded-full opacity-40 animate-pulse pointer-events-none" style={{ animationDelay: "1.1s" }} />

          <div className="relative grid md:grid-cols-2 gap-8 md:gap-12 items-center">

            {/* Columna texto */}
            <div>
              {/* Badge LIVE con pulse ring */}
              <div className="inline-flex items-center gap-2 bg-white/15 backdrop-blur-sm border border-white/30 px-3.5 py-1.5 rounded-full text-xs font-bold uppercase tracking-[0.18em] mb-5">
                <span className="relative flex w-2.5 h-2.5">
                  <span className={`absolute inset-0 rounded-full bg-white ${activeLive ? "animate-ping" : ""} opacity-75`} />
                  <span className="relative w-2.5 h-2.5 rounded-full bg-white" />
                </span>
                {activeLive ? "EN VIVO AHORA" : "PRÓXIMAMENTE"}
              </div>

              <h2 className="font-display text-3xl sm:text-4xl md:text-5xl lg:text-6xl mb-4 leading-[1.05] font-black">
                Las dinámicas en vivo <span className="italic font-normal">más esperadas.</span>
              </h2>
              <p className="text-white/90 text-base md:text-lg mb-6 leading-relaxed max-w-lg">
                Cápsulas, sobres, bolsitas. Mientras hago el LIVE en TikTok, vos comprás acá con lugar reservado y pago seguro.
              </p>

              {/* Mini-features */}
              <ul className="flex flex-wrap gap-2 mb-7">
                <li className="inline-flex items-center gap-1.5 bg-white/15 backdrop-blur-sm border border-white/25 px-3 py-1.5 rounded-full text-xs md:text-sm font-semibold">
                  <ShoppingBag className="w-3.5 h-3.5" /> Lugar reservado
                </li>
                <li className="inline-flex items-center gap-1.5 bg-white/15 backdrop-blur-sm border border-white/25 px-3 py-1.5 rounded-full text-xs md:text-sm font-semibold">
                  <Truck className="w-3.5 h-3.5" /> Te llega a casa
                </li>
                <li className="inline-flex items-center gap-1.5 bg-white/15 backdrop-blur-sm border border-white/25 px-3 py-1.5 rounded-full text-xs md:text-sm font-semibold">
                  <Heart className="w-3.5 h-3.5" /> Pago seguro
                </li>
              </ul>

              <Link
                href={activeLive ? `/live/${activeLive.id}` : "/live"}
                className="inline-flex items-center gap-2 bg-white text-rose-deep px-7 py-3.5 rounded-full font-bold shadow-lg hover:scale-105 hover:shadow-2xl transition-all"
              >
                {activeLive ? "Entrar al LIVE" : "Ver próximos eventos"}
                <ArrowRight className="w-4 h-4" />
              </Link>
            </div>

            {/* Columna visual — phone mockup. Sólo desktop. */}
            <div className="hidden md:flex justify-center items-center">
              <div className="relative w-[260px] h-[460px] rounded-[2.5rem] bg-gradient-to-b from-[#1a1a1a] to-[#0a0a0a] p-3 shadow-[0_30px_60px_-15px_rgba(0,0,0,0.5)] rotate-[6deg] hover:rotate-0 transition-transform duration-500">
                {/* Notch */}
                <div className="absolute top-3 left-1/2 -translate-x-1/2 w-20 h-5 bg-black rounded-full z-10" />
                {/* Pantalla */}
                <div className="w-full h-full rounded-[2rem] bg-gradient-to-br from-rose-deep via-rose-primary to-rose-medium overflow-hidden relative">
                  {/* Bg decorativo en la pantalla */}
                  <div className="absolute -top-10 -left-10 w-32 h-32 bg-white/20 rounded-full blur-2xl" />
                  <div className="absolute -bottom-10 -right-10 w-40 h-40 bg-rose-deep/60 rounded-full blur-2xl" />

                  {/* Contenido del phone */}
                  <div className="relative h-full flex flex-col justify-between p-4 pt-8 text-white">
                    {/* Top: LIVE badge */}
                    <div className="flex items-center justify-between">
                      <div className="inline-flex items-center gap-1.5 bg-rose-deep px-2.5 py-1 rounded-md text-[10px] font-black tracking-wider shadow-md">
                        <span className="relative flex w-1.5 h-1.5">
                          <span className="absolute inset-0 rounded-full bg-white animate-ping opacity-75" />
                          <span className="relative w-1.5 h-1.5 rounded-full bg-white" />
                        </span>
                        LIVE
                      </div>
                      <div className="text-[10px] font-bold bg-black/40 backdrop-blur px-2 py-0.5 rounded">
                        👀 1.2K
                      </div>
                    </div>

                    {/* Middle: producto + precio */}
                    <div className="flex flex-col items-center text-center">
                      <div className="text-7xl mb-2 drop-shadow-2xl">🎁</div>
                      <div className="bg-white/20 backdrop-blur-md border border-white/30 rounded-2xl px-4 py-3 shadow-xl">
                        <p className="text-[10px] uppercase tracking-wider opacity-80">Cápsula del día</p>
                        <p className="font-black text-xl mt-0.5">$7.000</p>
                      </div>
                    </div>

                    {/* Bottom: chat bubbles */}
                    <div className="space-y-1.5">
                      <div className="text-[10px] bg-black/30 backdrop-blur px-2.5 py-1 rounded-full inline-block">
                        <strong className="text-rose-pastel">@maru</strong> me la llevo!! 🌸
                      </div>
                      <div className="text-[10px] bg-black/30 backdrop-blur px-2.5 py-1 rounded-full inline-block">
                        <strong className="text-rose-pastel">@sofi</strong> reservame una porfa
                      </div>
                      <div className="flex items-center gap-2 mt-3 bg-white/15 backdrop-blur border border-white/25 rounded-full px-3 py-1.5">
                        <span className="text-[10px] opacity-70 flex-1">Escribir un comentario...</span>
                        <Heart className="w-3.5 h-3.5 fill-white" />
                      </div>
                    </div>
                  </div>
                </div>
              </div>
            </div>

          </div>
        </div>
      </section>

      {/* CATEGORÍAS */}
      <section className="max-w-6xl mx-auto px-4 mt-12 mb-16">
        <h2 className="font-sans text-xl md:text-2xl font-black tracking-tight mb-8 text-center uppercase leading-tight">
          <span className="text-ink-primary">Elegí la categoría del producto que </span><span className="text-rose-deep">necesitás</span>
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
                className="category-glow relative aspect-square rounded-3xl shadow-soft hover:shadow-lift transition-all hover:-translate-y-1 group"
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
