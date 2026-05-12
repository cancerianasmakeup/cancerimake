"use client";

import { useEffect, useMemo, useState } from "react";
import Image from "next/image";
import Link from "next/link";
import { Sparkles, Mail, Phone, Bell, CheckCircle2, Home } from "lucide-react";
import { toast } from "sonner";
import { createSupabaseBrowser } from "@/lib/supabase-browser";
import { BRAND } from "@/lib/brand";
import {
  getStoreStatus,
  getCountdown,
  isValidEmail,
  isValidPhoneAR,
  type StoreStatusConfig,
} from "@cancerianas/shared";

/**
 * Landing exclusiva que se muestra cuando la tienda está cerrada.
 * Mobile-first: la mayoría del tráfico viene de TikTok.
 */
export default function StoreClosedLanding({ config }: { config: StoreStatusConfig }) {
  const [now, setNow] = useState(() => new Date());

  useEffect(() => {
    const t = setInterval(() => setNow(new Date()), 1000);
    return () => clearInterval(t);
  }, []);

  // Recalculá status acá del lado del cliente para que sea reactivo
  const status = useMemo(() => getStoreStatus(config, now), [config, now]);
  const cd = getCountdown(status.opensAt, now);

  // Si justo acaba de abrir, recargamos para que SSR muestre el catálogo
  useEffect(() => {
    if (status.isOpen) {
      const timeout = setTimeout(() => window.location.reload(), 800);
      return () => clearTimeout(timeout);
    }
  }, [status.isOpen]);

  return (
    <div className="min-h-screen petal-bg flex flex-col">
      {/* Mini header con logo */}
      <header className="px-4 pt-6 pb-2 flex items-center justify-between max-w-xl mx-auto w-full">
        <Link href="/" className="p-2 rounded-full bg-white/70 hover:bg-white shadow text-ink-primary transition" aria-label="Ir al inicio">
          <Home className="w-5 h-5" />
        </Link>
        <img
          src={BRAND.logoUrl}
          alt={BRAND.name}
          className="h-11 md:h-14 w-auto object-contain"
        />
        <div className="w-9" />{/* spacer */}
      </header>

      <main className="flex-1 flex items-center justify-center px-4 py-8">
        <div className="w-full max-w-xl">
          <div className="card text-center relative overflow-hidden">
            {/* Pétalos decorativos */}
            <div className="absolute top-4 right-4 text-3xl opacity-40 animate-float pointer-events-none">🌸</div>
            <div className="absolute bottom-6 left-4 text-2xl opacity-30 animate-float pointer-events-none" style={{ animationDelay: "1.5s" }}>🌷</div>

            {/* Imagen promo tienda cerrada */}
            <img
              src="https://pub-4ee8d6afe02b441fa29b28b501f5a6be.r2.dev/TIENDAOFF.png"
              alt="Tienda temporalmente cerrada"
              className="w-full rounded-2xl object-contain"
            />

            {/* Countdown */}
            {status.opensAt && !cd.expired && (
              <>
                <div className="text-xs uppercase tracking-widest text-ink-soft mt-8 mb-2 font-bold">
                  Abrimos en
                </div>
                <div className="grid grid-cols-4 gap-2 max-w-md mx-auto">
                  <CountBox value={cd.days} label="días" />
                  <CountBox value={cd.hours} label="horas" />
                  <CountBox value={cd.minutes} label="min" />
                  <CountBox value={cd.seconds} label="seg" pulse />
                </div>
                <div className="text-sm text-ink-soft mt-3">
                  {formatOpenAt(status.opensAt, config.timezone)}
                </div>
                {status.nextDrop?.label && (
                  <div className="mt-1 text-xs text-rose-deep font-semibold uppercase tracking-wider">
                    {status.nextDrop.label}
                  </div>
                )}
              </>
            )}

            <p className="text-sm text-ink-soft mt-6 leading-relaxed">{config.closed_subtitle}</p>

            <div className="mt-6">
              <SubscribeForm />
            </div>

            <div className="flex flex-wrap justify-center gap-2 mt-5 pt-5 border-t border-rose-pastel">
              {config.tiktok_url && (
                <a
                  href={config.tiktok_url}
                  target="_blank"
                  rel="noopener"
                  className="inline-flex items-center gap-2 px-4 py-2.5 rounded-full bg-ink-primary text-white font-semibold text-sm hover:scale-105 transition-transform"
                >
                  <TikTokIcon /> Seguime en TikTok
                </a>
              )}
              {config.instagram_url && (
                <a
                  href={config.instagram_url}
                  target="_blank"
                  rel="noopener"
                  className="inline-flex items-center gap-2 px-4 py-2.5 rounded-full bg-gradient-to-tr from-rose-deep via-rose-primary to-rose-medium text-white font-semibold text-sm hover:scale-105 transition-transform"
                >
                  <InstagramIcon /> Instagram
                </a>
              )}
            </div>
          </div>

          <div className="text-center text-xs text-ink-soft mt-5">
            {BRAND.name} · {BRAND.tagline}
          </div>

          <div className="mt-6 pt-5 border-t border-rose-pastel">
            <Link href="/" className="btn-secondary w-full justify-center">
              Volvé al inicio
            </Link>
          </div>
        </div>
      </main>
    </div>
  );
}

function CountBox({ value, label, pulse }: { value: number; label: string; pulse?: boolean }) {
  return (
    <div className="flex flex-col items-center bg-gradient-to-br from-rose-pastel to-rose-medium/40 rounded-2xl py-4 px-2">
      <span
        className={`font-display text-3xl md:text-5xl font-bold text-ink-primary tabular-nums ${
          pulse ? "animate-soft-pulse" : ""
        }`}
      >
        {String(value).padStart(2, "0")}
      </span>
      <span className="text-[10px] md:text-xs uppercase tracking-wider text-ink-soft font-bold mt-1">
        {label}
      </span>
    </div>
  );
}

function SubscribeForm() {
  const supabase = createSupabaseBrowser();
  const [email, setEmail] = useState("");
  const [phone, setPhone] = useState("");
  const [loading, setLoading] = useState(false);
  const [done, setDone] = useState(false);

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    const emailTrim = email.trim();
    const phoneTrim = phone.trim();

    if (!emailTrim && !phoneTrim) {
      toast.error("Dejame al menos un email o un WhatsApp 🌸");
      return;
    }
    if (emailTrim && !isValidEmail(emailTrim)) {
      toast.error("Ese email no parece válido");
      return;
    }
    if (phoneTrim && !isValidPhoneAR(phoneTrim)) {
      toast.error("El número parece corto, revisalo");
      return;
    }

    setLoading(true);
    const { error } = await supabase.from("store_subscribers").insert({
      email: emailTrim || null,
      phone: phoneTrim || null,
      source: "landing_closed",
    });
    setLoading(false);

    if (error) {
      // 23505 = unique violation → ya estaba anotada, igual la tratamos como éxito
      if (error.code === "23505") {
        setDone(true);
        toast.success("Ya estabas anotada 🌸 te avisamos al abrir");
        return;
      }
      toast.error(error.message);
      return;
    }
    setDone(true);
    toast.success("¡Listo! Te avisamos al abrir 🌸");
  }

  if (done) {
    return (
      <div className="bg-success/10 border border-success/30 rounded-2xl p-5 inline-flex items-center gap-2 text-success font-semibold">
        <CheckCircle2 className="w-5 h-5" />
        Te avisamos al abrir el próximo drop 🌸
      </div>
    );
  }

  return (
    <form onSubmit={submit} className="space-y-3 max-w-md mx-auto">
      <div className="text-sm font-bold text-ink-primary mb-1 inline-flex items-center gap-2">
        <Bell className="w-4 h-4 text-rose-deep" /> Avisame cuando abra
      </div>
      <div className="relative">
        <Mail className="absolute left-4 top-1/2 -translate-y-1/2 w-4 h-4 text-ink-soft pointer-events-none" />
        <input
          type="email"
          value={email}
          onChange={(e) => setEmail(e.target.value)}
          placeholder="Tu email"
          autoComplete="email"
          inputMode="email"
          className="input pl-11"
        />
      </div>
      <div className="relative">
        <Phone className="absolute left-4 top-1/2 -translate-y-1/2 w-4 h-4 text-ink-soft pointer-events-none" />
        <input
          type="tel"
          value={phone}
          onChange={(e) => setPhone(e.target.value)}
          placeholder="WhatsApp (opcional)"
          autoComplete="tel"
          inputMode="tel"
          className="input pl-11"
        />
      </div>
      <button type="submit" disabled={loading} className="btn-primary w-full">
        {loading ? "Anotando..." : "Anotame al próximo drop"}
      </button>
      <p className="text-[11px] text-ink-soft px-2">
        Solo te escribimos cuando abrimos un drop nuevo. Sin spam.
      </p>
    </form>
  );
}

function formatOpenAt(d: Date, _tz: string): string {
  // El navegador resuelve la timezone del usuario; mostramos en su huso pero formato AR
  return d.toLocaleString("es-AR", {
    weekday: "long",
    day: "numeric",
    month: "long",
    hour: "2-digit",
    minute: "2-digit",
  });
}

function TikTokIcon() {
  return (
    <svg viewBox="0 0 24 24" className="w-4 h-4 fill-current">
      <path d="M19.59 6.69a4.83 4.83 0 0 1-3.77-4.25V2h-3.45v13.67a2.89 2.89 0 0 1-5.2 1.74 2.89 2.89 0 0 1 2.31-4.64 2.93 2.93 0 0 1 .88.13V9.4a6.84 6.84 0 0 0-1-.05A6.33 6.33 0 0 0 5.8 20.1a6.34 6.34 0 0 0 10.86-4.43V8.45a8.16 8.16 0 0 0 4.77 1.52V6.55a4.85 4.85 0 0 1-1.84-.36z" />
    </svg>
  );
}

function InstagramIcon() {
  return (
    <svg viewBox="0 0 24 24" className="w-4 h-4 fill-current">
      <path d="M12 2.2c3.2 0 3.6 0 4.85.07 1.17.05 1.8.25 2.23.41.56.22.96.48 1.38.9.42.42.68.82.9 1.38.16.42.36 1.06.41 2.23.06 1.27.07 1.65.07 4.85s0 3.58-.07 4.85c-.05 1.17-.25 1.8-.41 2.23-.22.56-.48.96-.9 1.38-.42.42-.82.68-1.38.9-.42.16-1.06.36-2.23.41-1.27.06-1.65.07-4.85.07s-3.58 0-4.85-.07c-1.17-.05-1.8-.25-2.23-.41-.56-.22-.96-.48-1.38-.9-.42-.42-.68-.82-.9-1.38-.16-.42-.36-1.06-.41-2.23C2.21 15.58 2.2 15.2 2.2 12s0-3.58.07-4.85c.05-1.17.25-1.8.41-2.23.22-.56.48-.96.9-1.38.42-.42.82-.68 1.38-.9.42-.16 1.06-.36 2.23-.41C8.42 2.21 8.8 2.2 12 2.2zm0 2.16c-3.14 0-3.51 0-4.74.07-1 .04-1.54.21-1.9.35-.48.18-.82.4-1.18.76-.36.36-.58.7-.76 1.18-.14.36-.31.9-.35 1.9-.07 1.23-.07 1.6-.07 4.74s0 3.51.07 4.74c.04 1 .21 1.54.35 1.9.18.48.4.82.76 1.18.36.36.7.58 1.18.76.36.14.9.31 1.9.35 1.23.07 1.6.07 4.74.07s3.51 0 4.74-.07c1-.04 1.54-.21 1.9-.35.48-.18.82-.4 1.18-.76.36-.36.58-.7.76-1.18.14-.36.31-.9.35-1.9.07-1.23.07-1.6.07-4.74s0-3.51-.07-4.74c-.04-1-.21-1.54-.35-1.9a3.16 3.16 0 0 0-.76-1.18 3.16 3.16 0 0 0-1.18-.76c-.36-.14-.9-.31-1.9-.35-1.23-.07-1.6-.07-4.74-.07zm0 3.68a4 4 0 1 1 0 8 4 4 0 0 1 0-8zm0 1.94a2.06 2.06 0 1 0 0 4.12 2.06 2.06 0 0 0 0-4.12zM18.4 6.5a.94.94 0 1 1 0 1.88.94.94 0 0 1 0-1.88z" />
    </svg>
  );
}
