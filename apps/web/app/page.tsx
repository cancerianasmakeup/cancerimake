import Link from "next/link";
import { ArrowRight, Sparkles, Heart, Truck, ShoppingBag } from "lucide-react";
import { createSupabaseServer } from "@/lib/supabase-server";
import Header from "@/components/Header";
import Footer from "@/components/Footer";
import HomeProductsMarquee from "@/components/HomeProductsMarquee";
import AdminPreviewBanner from "@/components/AdminPreviewBanner";
import DropCountdownStrip from "@/components/DropCountdownStrip";
import HeroDragSlider from "@/components/HeroDragSlider";
import CrabCompanion3D from "@/components/CrabCompanion3D";
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

      {/* Cangrejito 3D: arranca abajo de BIENVENIDA y acompaña el scroll
          (izquierda → derecha) hasta desvanecerse antes de las categorías */}
      <CrabCompanion3D />

      {/* Shell oscuro de la home: fondo negro glam con glows rosas,
          sparkles y corazones flotando (solo el menú queda blanco) */}
      <div className="relative overflow-hidden bg-[#0B0509]">
        {/* Decoración de fondo */}
        <div aria-hidden className="absolute inset-0 pointer-events-none">
          <div className="absolute -top-48 -left-48 w-[38rem] h-[38rem] bg-rose-deep/25 rounded-full blur-[140px]" />
          <div className="absolute top-[30%] -right-56 w-[34rem] h-[34rem] bg-[#FF4081]/15 rounded-full blur-[150px]" />
          <div className="absolute top-[62%] -left-40 w-[30rem] h-[30rem] bg-rose-primary/10 rounded-full blur-[130px]" />
          <div className="absolute bottom-0 right-[15%] w-[26rem] h-[26rem] bg-rose-deep/15 rounded-full blur-[120px]" />
          <Sparkles className="absolute top-[16%] left-[7%] w-4 h-4 text-rose-primary/70 sparkle-twinkle" />
          <Sparkles className="absolute top-[38%] right-[9%] w-3 h-3 text-white/50 sparkle-twinkle" style={{ animationDelay: "0.8s" }} />
          <Sparkles className="absolute top-[55%] left-[11%] w-3.5 h-3.5 text-rose-medium/60 sparkle-twinkle" style={{ animationDelay: "1.4s" }} />
          <Sparkles className="absolute top-[76%] right-[16%] w-4 h-4 text-rose-primary/50 sparkle-twinkle" style={{ animationDelay: "2s" }} />
          <Sparkles className="absolute top-[88%] left-[20%] w-3 h-3 text-white/40 sparkle-twinkle" style={{ animationDelay: "2.6s" }} />
          <Heart className="absolute top-[24%] right-[5%] w-5 h-5 text-rose-deep/40 fill-current animate-float" />
          <Heart className="absolute top-[68%] left-[4%] w-4 h-4 text-rose-primary/30 fill-current animate-float" style={{ animationDelay: "1.2s" }} />
        </div>

      {/* HERO — full viewport con carrusel flotante */}
      <section className="relative overflow-hidden min-h-[80dvh] flex items-start">
        {/* Video fondo */}
        <video
          autoPlay
          loop
          muted
          playsInline
          preload="none"
          className="absolute inset-0 w-full h-full object-cover pointer-events-none opacity-60"
          src="https://pub-4ee8d6afe02b441fa29b28b501f5a6be.r2.dev/fondocance1.mp4"
        />
        {/* Overlay oscuro: deja entrever el video y funde con el fondo negro */}
        <div className="absolute inset-0 bg-gradient-to-b from-[#0B0509]/90 via-[#0B0509]/55 to-[#0B0509]" />

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

          {/* Slot donde "vive" el cangrejito 3D al entrar (el canvas es fixed,
              este div solo reserva el lugar y sirve de ancla de posición) */}
          <div id="crab-3d-anchor" aria-hidden className="h-48 md:h-72 -mt-2 -mb-2 flex items-center justify-center">
            {/* Aura rosa detrás del cangrejo para que brille sobre el negro */}
            <div className="w-64 md:w-96 h-24 md:h-36 bg-rose-deep/30 blur-3xl rounded-full" />
          </div>

          {/* Slider arrastrable de fotos (para volver al viejo: <BannerCarousel />
              o al 3D: <Carousel3D /> — ambos siguen en components/) */}
          <HeroDragSlider />

          {/* Texto hero — siempre centrado horizontalmente */}
          <div className="relative max-w-2xl mx-auto space-y-6 text-center">
            {/* Glow suave detrás del título */}
            <div className="absolute -top-6 left-1/2 -translate-x-1/2 w-3/4 h-32 bg-rose-deep/30 blur-3xl rounded-full pointer-events-none" aria-hidden />

            <h1 className="relative font-display text-[clamp(2rem,9vw,5rem)] md:text-7xl leading-[1.05] text-white drop-shadow-sm font-black md:whitespace-nowrap">
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

            <p className="text-base md:text-lg text-white/75 leading-relaxed max-w-md mx-auto">
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
              <span className="inline-flex items-center gap-2 bg-white/10 backdrop-blur-sm border border-white/15 rounded-full px-3.5 py-1.5 text-xs md:text-sm text-white/85 font-medium shadow-[0_2px_8px_rgba(255,143,163,0.15)]">
                <Truck className="w-3.5 h-3.5 text-rose-primary" /> Envíos a todo el país
              </span>
              <span className="inline-flex items-center gap-2 bg-white/10 backdrop-blur-sm border border-white/15 rounded-full px-3.5 py-1.5 text-xs md:text-sm text-white/85 font-medium shadow-[0_2px_8px_rgba(255,143,163,0.15)]">
                <Heart className="w-3.5 h-3.5 text-rose-primary" /> Hecho con amor
              </span>
              <span className="inline-flex items-center gap-2 bg-white/10 backdrop-blur-sm border border-white/15 rounded-full px-3.5 py-1.5 text-xs md:text-sm text-white/85 font-medium shadow-[0_2px_8px_rgba(255,143,163,0.15)]">
                <Sparkles className="w-3.5 h-3.5 text-rose-primary" /> Drops exclusivos
              </span>
            </div>
          </div>

        </div>
      </section>

      {/* CATEGORÍAS — grilla editorial 3×2, justo debajo del hero */}
      <section className="max-w-6xl mx-auto px-4 -mt-6 md:-mt-10 mb-20 relative">
        <h2 className="font-display text-3xl md:text-5xl font-black text-white text-center mb-3 leading-[0.98]">
          Elegí la categoría que{" "}
          <span className="italic bg-gradient-to-r from-rose-primary via-rose-medium to-rose-deep bg-clip-text text-transparent">
            necesitás
          </span>
        </h2>
        <p className="text-white/50 text-sm md:text-base text-center mb-10">
          Todo lo que amás, ordenado para encontrarlo en segundos.
        </p>

        <div className="grid grid-cols-2 md:grid-cols-3 gap-4 md:gap-6">
          {(categories as Category[] | null)?.map((cat) => {
            const from = cat.gradient_from || "#FFE5EC";
            const to = cat.gradient_to || "#FFB3C6";
            return (
              <Link
                key={cat.id}
                href={`/category/${cat.slug}`}
                aria-label={cat.name}
                className="category-glow group relative block rounded-[1.75rem] aspect-square md:aspect-[16/11] transition-transform duration-300 hover:-translate-y-1.5"
              >
                {/* Contenido recortado (el glow vive en el Link, sin overflow) */}
                <div className="absolute inset-0 rounded-[inherit] overflow-hidden">
                  {/* Imagen / gradiente con zoom al hover */}
                  <div
                    className="absolute inset-0 transition-transform duration-700 ease-out group-hover:scale-110"
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
                  />
                  {/* Velo para legibilidad, se intensifica al hover */}
                  <div className="absolute inset-0 bg-gradient-to-t from-black/75 via-black/10 to-transparent group-hover:from-black/85 transition-colors duration-300" />

                  {/* Icono en chip de vidrio */}
                  <div className="absolute top-3.5 left-3.5 md:top-4 md:left-4 w-10 h-10 md:w-11 md:h-11 rounded-full bg-white/20 backdrop-blur-md border border-white/30 flex items-center justify-center shadow-lg group-hover:scale-110 group-hover:bg-white/30 transition-all">
                    <span className="text-lg md:text-xl leading-none">{cat.icon || "🌸"}</span>
                  </div>

                  {/* Barra inferior: nombre + flecha */}
                  <div className="absolute inset-x-0 bottom-0 p-4 md:p-5 flex items-end justify-between gap-3">
                    <div className="min-w-0">
                      <h3 className="font-display text-lg md:text-2xl font-black text-white leading-none drop-shadow-[0_2px_8px_rgba(0,0,0,0.6)]">
                        {cat.name}
                      </h3>
                      <p className="text-white/70 text-[11px] md:text-xs font-medium mt-1.5 line-clamp-1">
                        {cat.description || "Explorar la colección"}
                      </p>
                    </div>
                    <span className="shrink-0 w-9 h-9 md:w-11 md:h-11 rounded-full bg-white/15 backdrop-blur-md border border-white/25 flex items-center justify-center text-white -rotate-45 group-hover:rotate-0 group-hover:bg-rose-deep group-hover:border-rose-deep transition-all duration-300">
                      <ArrowRight className="w-4 h-4 md:w-5 md:h-5" />
                    </span>
                  </div>
                </div>
              </Link>
            );
          })}
        </div>
      </section>

      {/* DESTACADOS — marquesina en movimiento */}
      <section className="mb-20 relative">
        {/* Header centrado */}
        <div className="max-w-6xl mx-auto px-4 mb-10 text-center">
          <h2 className="font-display text-4xl md:text-6xl lg:text-7xl font-black text-white leading-[0.95]">
            Todos nuestros{" "}
            <span className="italic bg-gradient-to-r from-rose-primary via-rose-medium to-rose-deep bg-clip-text text-transparent">
              productos
            </span>
          </h2>
        </div>

        {(featured as Product[] | null)?.length ? (
          <>
            <HomeProductsMarquee products={featured as Product[]} />
            {/* CTA debajo de las 3 filas */}
            <div className="text-center mt-10 px-4">
              <Link href="/shop" className="btn-primary !px-10 !py-4 !text-base group">
                Ver toda la tienda
                <ArrowRight className="w-5 h-5 group-hover:translate-x-1 transition-transform" />
              </Link>
            </div>
          </>
        ) : (
          <div className="card text-center py-16 mx-4">
            <div className="text-6xl mb-4">🌸</div>
            <p className="text-ink-secondary">Todavía no hay productos destacados.</p>
            <p className="text-ink-soft text-sm mt-2">Agregá productos desde el panel admin y marcalos como destacados.</p>
          </div>
        )}
      </section>

      {/* TIKTOK BANNER — backstage neón */}
      <section className="max-w-6xl mx-auto px-4 mt-8 mb-4">
        <a
          href="https://www.tiktok.com/@cancerianas.makeup2"
          target="_blank"
          rel="noopener noreferrer"
          aria-label="Seguinos en TikTok @cancerianas.makeup2"
          className="group flex flex-col md:flex-row items-center justify-center gap-4 md:gap-0 hover:scale-[1.01] transition-transform active:scale-100"
        >
          {/* Logo sticker — con halo neón doble */}
          <div className="relative z-10 shrink-0 -mb-6 md:mb-0 md:-mr-10 md:-rotate-6 group-hover:md:-rotate-2 group-hover:md:scale-105 transition-transform duration-300">
            <div className="absolute inset-2 rounded-full bg-[#25F4EE]/25 blur-2xl group-hover:bg-[#25F4EE]/40 transition-colors" aria-hidden />
            <div className="absolute inset-4 translate-x-3 translate-y-3 rounded-full bg-[#FE2C55]/25 blur-2xl group-hover:bg-[#FE2C55]/40 transition-colors" aria-hidden />
            <svg
              viewBox="0 0 24 24"
              xmlns="http://www.w3.org/2000/svg"
              className="relative w-28 h-28 md:w-44 md:h-44"
              style={{ filter: "drop-shadow(0 18px 28px rgba(0,0,0,0.45))" }}
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

          {/* Card con borde degradé cyan→rosa */}
          <div className="relative w-full md:w-auto rounded-[2rem] p-[1.5px] bg-gradient-to-r from-[#25F4EE]/70 via-white/10 to-[#FE2C55]/70 shadow-[0_24px_70px_-20px_rgba(37,244,238,0.35),0_24px_70px_-20px_rgba(254,44,85,0.35)]">
            <div className="relative rounded-[calc(2rem-1.5px)] bg-[#050505] text-white overflow-hidden">
              {/* Glows internos pulsantes */}
              <div className="absolute -top-14 -left-14 w-56 h-56 bg-[#25F4EE] opacity-20 rounded-full blur-3xl pointer-events-none animate-soft-pulse" />
              <div className="absolute -bottom-14 -right-14 w-56 h-56 bg-[#FE2C55] opacity-20 rounded-full blur-3xl pointer-events-none animate-soft-pulse" style={{ animationDelay: "1s" }} />

              {/* Shine que barre la card al hover */}
              <div
                className="absolute inset-y-0 -left-1/3 w-1/4 bg-gradient-to-r from-transparent via-white/10 to-transparent -skew-x-12 group-hover:translate-x-[500%] transition-transform duration-1000 ease-out pointer-events-none"
                aria-hidden
              />

              {/* Notas musicales flotando */}
              <span className="absolute top-3 right-24 text-[#25F4EE]/50 text-lg animate-float pointer-events-none" aria-hidden>♪</span>
              <span className="absolute bottom-3 right-44 text-[#FE2C55]/50 text-sm animate-float pointer-events-none" style={{ animationDelay: "1.4s" }} aria-hidden>♫</span>

              <div className="relative px-6 py-6 md:pl-16 md:pr-9 md:py-8 flex flex-col md:flex-row items-center gap-5 md:gap-10 text-center md:text-left">
                <div>
                  <p className="text-[11px] uppercase tracking-[0.25em] font-bold text-[#25F4EE]">
                    Tu pase al backstage
                  </p>
                  <p className="font-display text-2xl md:text-4xl font-black tracking-tight mt-1.5 leading-none">
                    @cancerianas.<span className="bg-gradient-to-r from-[#25F4EE] to-[#FE2C55] bg-clip-text text-transparent">makeup2</span>
                  </p>
                  <p className="text-white/60 text-sm font-medium mt-2">
                    Drops, dinámicas y LIVES en TikTok
                  </p>
                  {/* Chips de comunidad */}
                  <div className="flex flex-wrap justify-center md:justify-start gap-2 mt-3.5">
                    <span className="inline-flex items-center gap-1.5 bg-white/[0.07] border border-white/15 rounded-full px-3 py-1 text-[11px] font-bold text-white/85">
                      🔥 +10K seguidoras
                    </span>
                    <span className="inline-flex items-center gap-1.5 bg-white/[0.07] border border-white/15 rounded-full px-3 py-1 text-[11px] font-bold text-white/85">
                      <span className="relative flex w-1.5 h-1.5">
                        <span className="absolute inset-0 rounded-full bg-[#FE2C55] animate-ping opacity-75" />
                        <span className="relative w-1.5 h-1.5 rounded-full bg-[#FE2C55]" />
                      </span>
                      LIVES semanales
                    </span>
                  </div>
                </div>
                <span className="inline-flex items-center gap-2 bg-white text-[#010101] rounded-full px-7 py-3.5 font-black text-sm tracking-wide shrink-0 shadow-[0_10px_30px_-8px_rgba(255,255,255,0.35)] group-hover:gap-3 group-hover:shadow-[0_12px_38px_-6px_rgba(37,244,238,0.45)] transition-all">
                  Seguir
                  <span className="inline-block group-hover:translate-x-1 transition-transform">→</span>
                </span>
              </div>
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

      </div>
      {/* /shell oscuro */}

      <Footer />
    </>
  );
}
