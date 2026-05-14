"use client";

import { Suspense, useEffect, useRef, useState } from "react";
import Script from "next/script";
import { useRouter, useSearchParams } from "next/navigation";
import { Sparkles, Mail, Lock, User } from "lucide-react";
import { toast } from "sonner";
import { createSupabaseBrowser } from "@/lib/supabase-browser";
import { BRAND } from "@/lib/brand";

const GOOGLE_CLIENT_ID = process.env.NEXT_PUBLIC_GOOGLE_CLIENT_ID;

declare global {
  interface Window {
    google?: {
      accounts: {
        id: {
          initialize: (cfg: Record<string, unknown>) => void;
          renderButton: (el: HTMLElement, opts: Record<string, unknown>) => void;
          prompt: () => void;
          cancel: () => void;
        };
      };
    };
  }
}

export default function AuthPage() {
  return (
    <Suspense>
      <AuthForm />
    </Suspense>
  );
}

function AuthForm() {
  const supabase = createSupabaseBrowser();
  const router = useRouter();
  const params = useSearchParams();
  const redirect = params.get("redirect") || "/";

  const [mode, setMode] = useState<"login" | "register">("login");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [name, setName] = useState("");
  const [lastName, setLastName] = useState("");
  const [loading, setLoading] = useState(false);
  const [gsiReady, setGsiReady] = useState(false);

  const googleBtnRef = useRef<HTMLDivElement | null>(null);
  const initedRef = useRef(false);
  // Mantenemos el handler en un ref para que GIS llame siempre a la versión
  // actual sin tener que re-inicializar el cliente de Google.
  const handleCredentialRef = useRef<(idToken: string) => void>(() => {});

  handleCredentialRef.current = async (idToken: string) => {
    setLoading(true);
    try {
      const { error } = await supabase.auth.signInWithIdToken({
        provider: "google",
        token: idToken,
      });
      if (error) throw error;
      toast.success("Hola 🌸");
      router.replace(redirect);
    } catch (e: any) {
      toast.error(e.message || "No pudimos entrar con Google");
      setLoading(false);
    }
  };

  useEffect(() => {
    if (!gsiReady || initedRef.current) return;
    if (!window.google || !googleBtnRef.current || !GOOGLE_CLIENT_ID) return;

    initedRef.current = true;

    window.google.accounts.id.initialize({
      client_id: GOOGLE_CLIENT_ID,
      callback: (resp: { credential: string }) =>
        handleCredentialRef.current(resp.credential),
      ux_mode: "popup",
      auto_select: false,
    });

    window.google.accounts.id.renderButton(googleBtnRef.current, {
      type: "standard",
      theme: "outline",
      size: "large",
      shape: "pill",
      text: "continue_with",
      logo_alignment: "left",
      width: googleBtnRef.current.offsetWidth || 360,
    });
  }, [gsiReady]);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setLoading(true);

    try {
      if (mode === "login") {
        const { error } = await supabase.auth.signInWithPassword({ email, password });
        if (error) throw error;
        toast.success("Hola de nuevo 🌸");
      } else {
        const fullName = `${name} ${lastName}`.trim();
        const { error } = await supabase.auth.signUp({
          email,
          password,
          options: {
            data: {
              full_name: fullName,
              first_name: name,
              last_name: lastName,
            },
          },
        });
        if (error) throw error;
        toast.success("¡Bienvenida! 🌸");
      }
      router.replace(redirect);
    } catch (e: any) {
      toast.error(e.message || "Algo falló");
    } finally {
      setLoading(false);
    }
  }

  return (
    <>
      <Script
        src="https://accounts.google.com/gsi/client"
        strategy="afterInteractive"
        onLoad={() => setGsiReady(true)}
      />

      <div className="min-h-screen flex items-center justify-center px-4">
        <div className="w-full max-w-md">
          <div className="text-center mb-8">
            <img src={BRAND.logoUrl} alt={BRAND.name} className="h-14 mx-auto mb-4 object-contain" />
            <p className="text-ink-secondary italic">{BRAND.tagline}</p>
          </div>

          <div className="card">
            <div className="flex bg-rose-whisper rounded-full p-1 mb-6">
              <button
                onClick={() => setMode("login")}
                className={`flex-1 py-2 rounded-full font-semibold transition ${
                  mode === "login" ? "bg-white shadow-soft" : "text-ink-soft"
                }`}
              >
                Entrar
              </button>
              <button
                onClick={() => setMode("register")}
                className={`flex-1 py-2 rounded-full font-semibold transition ${
                  mode === "register" ? "bg-white shadow-soft" : "text-ink-soft"
                }`}
              >
                Crear cuenta
              </button>
            </div>

            <form onSubmit={handleSubmit} className="space-y-4">
              {mode === "register" && (
                <>
                  <div className="relative">
                    <User className="absolute left-4 top-1/2 -translate-y-1/2 w-4 h-4 text-ink-soft" />
                    <input
                      className="input pl-11"
                      placeholder="Tu nombre"
                      value={name}
                      onChange={e => setName(e.target.value)}
                      required
                    />
                  </div>
                  <div className="relative">
                    <User className="absolute left-4 top-1/2 -translate-y-1/2 w-4 h-4 text-ink-soft" />
                    <input
                      className="input pl-11"
                      placeholder="Tu apellido"
                      value={lastName}
                      onChange={e => setLastName(e.target.value)}
                      required
                    />
                  </div>
                </>
              )}
              <div className="relative">
                <Mail className="absolute left-4 top-1/2 -translate-y-1/2 w-4 h-4 text-ink-soft" />
                <input
                  className="input pl-11"
                  type="email"
                  placeholder="Tu email"
                  value={email}
                  onChange={e => setEmail(e.target.value)}
                  required
                />
              </div>
              <div className="relative">
                <Lock className="absolute left-4 top-1/2 -translate-y-1/2 w-4 h-4 text-ink-soft" />
                <input
                  className="input pl-11"
                  type="password"
                  placeholder="Contraseña (mín. 6 caracteres)"
                  value={password}
                  onChange={e => setPassword(e.target.value)}
                  minLength={6}
                  required
                />
              </div>

              <button type="submit" disabled={loading} className="btn-primary w-full">
                <Sparkles className="w-4 h-4" />
                {loading ? "Procesando..." : mode === "login" ? "Entrar" : "Crear cuenta"}
              </button>
            </form>

            <div className="flex items-center gap-3 my-5">
              <div className="flex-1 h-px bg-rose-pastel" />
              <span className="text-xs text-ink-soft">o continuá con</span>
              <div className="flex-1 h-px bg-rose-pastel" />
            </div>

            {GOOGLE_CLIENT_ID ? (
              <div className="flex justify-center min-h-[48px]">
                <div ref={googleBtnRef} />
              </div>
            ) : (
              <p className="text-xs text-rose-deep text-center">
                Falta configurar <code>NEXT_PUBLIC_GOOGLE_CLIENT_ID</code> en <code>.env.local</code>
              </p>
            )}

            <p className="text-xs text-ink-soft text-center mt-6">
              Al continuar, aceptás nuestros términos y privacidad.
            </p>
          </div>

          <p className="text-center mt-6">
            <a href="/" className="text-sm text-ink-soft hover:text-rose-deep">← Volver a la tienda</a>
          </p>
        </div>
      </div>
    </>
  );
}
