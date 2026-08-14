"use client";

import { useRouter } from "next/navigation";
import { useState } from "react";

import { createSupabaseBrowser } from "@/lib/supabase-browser";
import type { StoreConfig } from "@/lib/stores";
import { selectStore } from "./AdminStoreChooser";

/**
 * Login para la tienda seleccionada.
 *
 * Cada tienda es un proyecto Supabase distinto, con su propio padrón de
 * usuarios: la sesión de Buenos Aires no sirve en Mar del Plata. Este form vive
 * bajo /admin, así que createSupabaseBrowser() resuelve contra la tienda elegida.
 * Las cookies de sesión se llaman sb-<project-ref>-auth-token, o sea que las dos
 * sesiones conviven y esto se pide una sola vez por tienda.
 */
export default function AdminStoreLogin({
  store,
  stores,
}: {
  store: StoreConfig;
  stores: StoreConfig[];
}) {
  const router = useRouter();
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  async function onSubmit(e: React.FormEvent) {
    e.preventDefault();
    setLoading(true);
    setError(null);

    const supabase = createSupabaseBrowser();
    const { error } = await supabase.auth.signInWithPassword({ email, password });

    if (error) {
      setError(error.message);
      setLoading(false);
      return;
    }
    router.refresh();
  }

  const otras = stores.filter((s) => s.id !== store.id);

  return (
    <div className="min-h-screen flex items-center justify-center px-4">
      <div className="card w-full max-w-md">
        <div className="text-center mb-6">
          {store.logoUrl && (
            // eslint-disable-next-line @next/next/no-img-element
            <img src={store.logoUrl} alt={store.name} className="h-16 w-auto mx-auto mb-3 object-contain" />
          )}
          <h1 className="font-display text-2xl text-ink-primary">{store.shortName}</h1>
          <p className="text-ink-secondary text-sm mt-2">
            Esta tienda tiene su propia base de datos, así que necesita su propio inicio de sesión.
            Es una sola vez: después el navegador se acuerda de las dos.
          </p>
        </div>

        <form onSubmit={onSubmit} className="space-y-3">
          <input
            type="email"
            required
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            placeholder="Email"
            className="input w-full"
            autoComplete="email"
          />
          <input
            type="password"
            required
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            placeholder="Contraseña"
            className="input w-full"
            autoComplete="current-password"
          />

          {error && <p className="text-sm text-red-600">{error}</p>}

          <button type="submit" disabled={loading} className="btn-primary w-full disabled:opacity-60">
            {loading ? "Entrando…" : `Entrar a ${store.shortName}`}
          </button>
        </form>

        {otras.length > 0 && (
          <div className="mt-6 pt-4 border-t border-rose-pastel text-center">
            <p className="text-xs text-ink-soft mb-2">¿Te equivocaste de tienda?</p>
            {otras.map((s) => (
              <button
                key={s.id}
                type="button"
                onClick={() => {
                  selectStore(s.id);
                  router.refresh();
                }}
                className="text-sm text-rose-deep hover:underline"
              >
                Ir a {s.shortName}
              </button>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
