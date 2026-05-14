"use client";

import Link from "next/link";
import { useEffect, useMemo, useState } from "react";
import { ShoppingCart, User, Menu, X, Sparkles, Zap } from "lucide-react";
import { createSupabaseBrowser } from "@/lib/supabase-browser";
import { BRAND } from "@/lib/brand";
import { DEFAULT_BRAND, type BrandInfo } from "@/lib/site-settings-types";
import {
  DEFAULT_STORE_STATUS,
  getStoreStatus,
  getCountdown,
  type StoreStatusConfig,
} from "@cancerianas/shared";

type AppearanceCfg = { show_announcement_bar?: boolean; announcement_text?: string; announcement_link?: string };

export default function Header() {
  const [open, setOpen] = useState(false);
  const [user, setUser] = useState<any>(null);
  const [activeLive, setActiveLive] = useState<any>(null);
  const [storeConfig, setStoreConfig] = useState<StoreStatusConfig>(DEFAULT_STORE_STATUS);
  const [brand, setBrand] = useState<BrandInfo>({ ...DEFAULT_BRAND, name: BRAND.name, tagline: BRAND.tagline, logo_url: BRAND.logoUrl });
  const [appearance, setAppearance] = useState<AppearanceCfg>({});
  const [now, setNow] = useState(() => new Date());
  const supabase = createSupabaseBrowser();

  useEffect(() => {
    supabase.auth.getUser().then(({ data }) => setUser(data.user));

    // Detectar si hay LIVE activo. Usamos maybeSingle para no tirar 406
    // cuando no hay ningún evento activo (lo normal el 99% del tiempo).
    supabase
      .from("live_events")
      .select("id, title")
      .eq("status", "active")
      .limit(1)
      .maybeSingle()
      .then(({ data }) => setActiveLive(data));

    // Cargar settings en paralelo (store_status + brand_info + appearance)
    supabase
      .from("site_settings")
      .select("key, value")
      .in("key", ["store_status", "brand_info", "appearance"])
      .then(({ data }) => {
        (data ?? []).forEach((row: any) => {
          if (row.key === "store_status") setStoreConfig({ ...DEFAULT_STORE_STATUS, ...row.value });
          else if (row.key === "brand_info") setBrand((prev) => ({ ...prev, ...row.value }));
          else if (row.key === "appearance") setAppearance(row.value);
        });
      });

    // Suscripción Realtime al estado del LIVE
    const channel = supabase
      .channel("header-live-watcher")
      .on(
        "postgres_changes",
        { event: "*", schema: "public", table: "live_events" },
        () => {
          supabase
            .from("live_events")
            .select("id, title")
            .eq("status", "active")
            .limit(1)
            .maybeSingle()
            .then(({ data }) => setActiveLive(data));
        }
      )
      .on(
        "postgres_changes",
        { event: "*", schema: "public", table: "site_settings", filter: "key=eq.store_status" },
        (payload: any) => {
          if (payload.new?.value) {
            setStoreConfig({
              ...DEFAULT_STORE_STATUS,
              ...(payload.new.value as Partial<StoreStatusConfig>),
            });
          }
        }
      )
      .subscribe();

    const tick = setInterval(() => setNow(new Date()), 1000);
    return () => {
      supabase.removeChannel(channel);
      clearInterval(tick);
    };
  }, []);

  const storeStatus = useMemo(() => getStoreStatus(storeConfig, now), [storeConfig, now]);
  const closeCountdown = useMemo(
    () => getCountdown(storeStatus.closesAt, now),
    [storeStatus.closesAt, now]
  );

  return (
    <>
      {activeLive && (
        <Link
          href={`/live/${activeLive.id}`}
          className="block bg-gradient-to-r from-rose-deep via-rose-primary to-rose-deep text-white text-sm py-2 px-4 text-center font-semibold animate-soft-pulse"
        >
          <span className="inline-flex items-center gap-2">
            <span className="w-2 h-2 bg-white rounded-full animate-pulse" />
            EN VIVO AHORA: {activeLive.title} — Tocá para entrar
            <Sparkles className="w-4 h-4" />
          </span>
        </Link>
      )}

      {storeStatus.isOpen && (
        <div className="block bg-gradient-to-r from-success via-rose-primary to-rose-deep text-white text-xs sm:text-sm py-2 px-3 sm:px-4 text-center font-semibold">
          <span className="inline-flex items-center gap-2 flex-wrap justify-center">
            <Zap className="w-4 h-4 flex-shrink-0" />
            <span className="line-clamp-1">{storeConfig.open_banner_text}</span>
            {storeStatus.closesAt && !closeCountdown.expired && (
              <span className="font-mono tabular-nums whitespace-nowrap">
                · cierra en{" "}
                {closeCountdown.days > 0 && `${closeCountdown.days}d `}
                {String(closeCountdown.hours).padStart(2, "0")}:
                {String(closeCountdown.minutes).padStart(2, "0")}:
                {String(closeCountdown.seconds).padStart(2, "0")}
              </span>
            )}
          </span>
        </div>
      )}

      {/* Banner de anuncio configurable */}
      {appearance.show_announcement_bar && appearance.announcement_text && (
        appearance.announcement_link ? (
          <Link href={appearance.announcement_link} className="block bg-ink-primary text-white text-xs sm:text-sm py-1.5 px-4 text-center font-medium hover:bg-ink-secondary transition">
            {appearance.announcement_text}
          </Link>
        ) : (
          <div className="bg-ink-primary text-white text-xs sm:text-sm py-1.5 px-4 text-center font-medium">
            {appearance.announcement_text}
          </div>
        )
      )}

      <header className="sticky top-0 z-40 backdrop-blur-md bg-cream/80 border-b border-rose-pastel">
        <div className="max-w-6xl mx-auto px-4 py-3 flex items-center justify-between">
          <Link href="/" className="flex items-center gap-2">
            {/* Logo desde R2. Usa img normal porque next/image puede fallar con CORS */}
            <img
              src={brand.logo_url}
              alt={brand.name}
              className="h-10 md:h-12 w-auto object-contain"
            />
          </Link>

          <nav className="hidden md:flex items-center gap-8 text-ink-secondary font-medium">
            <Link href="/" className="hover:text-rose-deep transition">Inicio</Link>
            <Link href="/shop" className="hover:text-rose-deep transition">Tienda</Link>
            <Link href="/live" className="hover:text-rose-deep transition flex items-center gap-1">
              LIVE {activeLive && <span className="w-2 h-2 bg-rose-deep rounded-full animate-pulse" />}
            </Link>
            <Link href="/orders" className="hover:text-rose-deep transition">Mis compras</Link>
          </nav>

          <div className="flex items-center gap-3">
            <Link
              href={user ? "/account" : "/auth"}
              className="p-2 rounded-full hover:bg-rose-whisper transition"
              aria-label="Cuenta"
            >
              <User className="w-5 h-5 text-ink-primary" />
            </Link>
            <Link
              href="/checkout"
              className="p-2 rounded-full hover:bg-rose-whisper transition"
              aria-label="Carrito"
            >
              <ShoppingCart className="w-5 h-5 text-ink-primary" />
            </Link>
            <button
              className="md:hidden p-2 rounded-full hover:bg-rose-whisper transition"
              onClick={() => setOpen(!open)}
              aria-label="Menú"
            >
              {open ? <X className="w-5 h-5" /> : <Menu className="w-5 h-5" />}
            </button>
          </div>
        </div>

        {open && (
          <div className="md:hidden border-t border-rose-pastel bg-white/95 backdrop-blur">
            <nav className="flex flex-col p-4 gap-3">
              <Link href="/" onClick={() => setOpen(false)} className="py-2 text-ink-secondary">Inicio</Link>
              <Link href="/shop" onClick={() => setOpen(false)} className="py-2 text-ink-secondary">Tienda</Link>
              <Link href="/live" onClick={() => setOpen(false)} className="py-2 text-ink-secondary">LIVE</Link>
              <Link href="/orders" onClick={() => setOpen(false)} className="py-2 text-ink-secondary">Mis compras</Link>
              {user?.user_metadata?.role === "admin" && (
                <Link href="/admin" onClick={() => setOpen(false)} className="py-2 text-rose-deep font-semibold">Panel admin</Link>
              )}
            </nav>
          </div>
        )}
      </header>
    </>
  );
}
