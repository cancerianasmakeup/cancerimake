"use client";

import { useEffect, useRef, useState } from "react";
import { Sparkles, Mail, Lock, User } from "lucide-react";
import { toast } from "sonner";
import { createSupabaseBrowser } from "@/lib/supabase-browser";

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

type Props = {
  /** Llamado después de un login/signup exitoso. La page lo usa para redirigir;
   *  el modal lo usa para cerrarse y retomar la acción que el user iba a hacer. */
  onSuccess?: () => void;
  /** Modo inicial; el usuario puede cambiarlo después. Default: "login". */
  initialMode?: "login" | "register";
};

/**
 * Form de login + signup compartido entre la página /auth y el modal de login
 * que aparece cuando una clienta intenta agregar al carrito sin estar logueada.
 *
 * Soporta:
 *  - Sign in with Google vía GIS (signInWithIdToken; muestra el dominio nuestro,
 *    no el de Supabase). El nonce está desactivado en Supabase (Skip nonce checks).
 *  - Login email/password.
 *  - Signup email/password con first_name + last_name separados.
 */
export default function AuthForm({ onSuccess, initialMode = "login" }: Props) {
  const supabase = createSupabaseBrowser();

  const [mode, setMode] = useState<"login" | "register">(initialMode);
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [name, setName] = useState("");
  const [lastName, setLastName] = useState("");
  const [loading, setLoading] = useState(false);
  const [gsiReady, setGsiReady] = useState(false);

  const googleBtnRef = useRef<HTMLDivElement | null>(null);
  const initedRef = useRef(false);
  // Handler en ref para que GIS siempre llame a la versión actual sin
  // necesidad de re-inicializar (re-init = botón roto).
  const handleCredentialRef = useRef<(idToken: string) => void>(() => {});

  handleCredentialRef.current = async (idToken: string) => {
    setLoading(true);
    try {
      const { data, error } = await supabase.auth.signInWithIdToken({
        provider: "google",
        token: idToken,
      });
      if (error) throw error;
      const meta = data.user?.user_metadata ?? {};
      const firstName: string =
        meta.given_name || meta.first_name || (meta.full_name || meta.name || "").split(" ")[0] || "";
      toast.success(firstName ? `Hola 🌸 ${firstName}` : "Hola 🌸");
      onSuccess?.();
    } catch (e: any) {
      toast.error(e.message || "No pudimos entrar con Google");
      setLoading(false);
    }
  };

  // Cargamos el script de GIS manualmente (en vez de <Script> de next/script)
  // porque sus tipos chocan con los de React 19 en el build.
  useEffect(() => {
    if (!GOOGLE_CLIENT_ID) return;
    const SRC = "https://accounts.google.com/gsi/client";
    const existing = document.querySelector<HTMLScriptElement>(`script[src="${SRC}"]`);
    if (existing) {
      if ((window as any).google) setGsiReady(true);
      else existing.addEventListener("load", () => setGsiReady(true), { once: true });
      return;
    }
    const s = document.createElement("script");
    s.src = SRC;
    s.async = true;
    s.defer = true;
    s.onload = () => setGsiReady(true);
    document.head.appendChild(s);
  }, []);

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
        const { data, error } = await supabase.auth.signInWithPassword({ email, password });
        if (error) throw error;
        const meta = data.user?.user_metadata ?? {};
        const firstName: string =
          meta.first_name || meta.given_name || (meta.full_name || meta.name || "").split(" ")[0] || "";
        toast.success(firstName ? `Hola de nuevo 🌸 ${firstName}` : "Hola de nuevo 🌸");
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
        toast.success(name ? `¡Bienvenida 🌸 ${name}!` : "¡Bienvenida! 🌸");
      }
      onSuccess?.();
    } catch (e: any) {
      toast.error(e.message || "Algo falló");
    } finally {
      setLoading(false);
    }
  }

  return (
    <>
      <div className="flex bg-rose-whisper rounded-full p-1 mb-6">
        <button
          type="button"
          onClick={() => setMode("login")}
          className={`flex-1 py-2 rounded-full font-semibold transition ${
            mode === "login" ? "bg-white shadow-soft" : "text-ink-soft"
          }`}
        >
          Entrar
        </button>
        <button
          type="button"
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
    </>
  );
}
