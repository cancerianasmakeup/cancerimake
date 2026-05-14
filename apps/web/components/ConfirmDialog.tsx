"use client";

import { createContext, useCallback, useContext, useEffect, useRef, useState } from "react";
import { AlertTriangle, AlertCircle, CheckCircle2, X, Loader2 } from "lucide-react";

type Tone = "danger" | "warning" | "info" | "success";

export type ConfirmOptions = {
  title: string;
  description?: string;
  /** Texto del botón principal. Default: "Confirmar". */
  confirmLabel?: string;
  /** Texto del botón secundario. Default: "Cancelar". */
  cancelLabel?: string;
  /** Tono visual del diálogo (define color del icono y del botón principal). */
  tone?: Tone;
  /** Si está seteado, el usuario tiene que tipear este texto para habilitar el botón principal. */
  typeToConfirm?: string;
};

type DialogState = ConfirmOptions & {
  open: boolean;
  resolver: ((v: boolean) => void) | null;
};

type Ctx = {
  confirm: (opts: ConfirmOptions) => Promise<boolean>;
};

const ConfirmContext = createContext<Ctx | null>(null);

/** Hook para abrir un diálogo de confirmación. Devuelve una Promise<boolean>. */
export function useConfirm(): Ctx["confirm"] {
  const ctx = useContext(ConfirmContext);
  if (!ctx) throw new Error("useConfirm necesita estar dentro de <ConfirmProvider>");
  return ctx.confirm;
}

/** Provider que monta el modal una sola vez al root y expone confirm() vía hook. */
export function ConfirmProvider({ children }: { children: React.ReactNode }) {
  const [state, setState] = useState<DialogState>({
    open: false,
    title: "",
    resolver: null,
  });
  const [typed, setTyped] = useState("");
  const [busy, setBusy] = useState(false);
  const dialogRef = useRef<HTMLDivElement | null>(null);

  const confirm = useCallback((opts: ConfirmOptions) => {
    return new Promise<boolean>((resolve) => {
      setState({ open: true, ...opts, resolver: resolve });
      setTyped("");
      setBusy(false);
    });
  }, []);

  const close = (value: boolean) => {
    state.resolver?.(value);
    setState((s) => ({ ...s, open: false, resolver: null }));
    setTyped("");
    setBusy(false);
  };

  // Cerrar con Escape (cancela)
  useEffect(() => {
    if (!state.open) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape" && !busy) close(false);
    };
    document.addEventListener("keydown", onKey);
    // Lock scroll
    const prev = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    return () => {
      document.removeEventListener("keydown", onKey);
      document.body.style.overflow = prev;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [state.open, busy]);

  // Focus en el diálogo al abrirse para que Enter/Esc funcionen sin clickear
  useEffect(() => {
    if (state.open) dialogRef.current?.focus();
  }, [state.open]);

  const tone: Tone = state.tone ?? "info";
  const Icon =
    tone === "danger" ? AlertTriangle :
    tone === "warning" ? AlertCircle :
    tone === "success" ? CheckCircle2 :
                         AlertCircle;
  const iconBg =
    tone === "danger"  ? "bg-error/15 text-error" :
    tone === "warning" ? "bg-warning/15 text-warning" :
    tone === "success" ? "bg-success/15 text-success" :
                         "bg-rose-deep/15 text-rose-deep";
  const confirmBtnCls =
    tone === "danger"  ? "bg-error hover:bg-error/90 text-white" :
    tone === "warning" ? "bg-warning hover:bg-warning/90 text-white" :
    tone === "success" ? "bg-success hover:bg-success/90 text-white" :
                         "bg-rose-deep hover:bg-rose-deep/90 text-white";

  const requiresType = !!state.typeToConfirm && state.typeToConfirm.length > 0;
  const typeOk = !requiresType || typed.trim() === state.typeToConfirm;

  return (
    <ConfirmContext.Provider value={{ confirm }}>
      {children}

      {state.open && (
        <div
          className="fixed inset-0 z-[100] flex items-center justify-center px-4 py-6 bg-ink-primary/60 backdrop-blur-sm animate-[fade-in_0.15s_ease-out]"
          onClick={() => !busy && close(false)}
          role="dialog"
          aria-modal="true"
          aria-labelledby="confirm-title"
        >
          <div
            ref={dialogRef}
            tabIndex={-1}
            onClick={(e) => e.stopPropagation()}
            className="relative w-full max-w-md bg-white rounded-3xl shadow-2xl p-6 outline-none animate-[scale-in_0.2s_cubic-bezier(0.34,1.56,0.64,1)]"
          >
            {!busy && (
              <button
                onClick={() => close(false)}
                aria-label="Cerrar"
                className="absolute top-3 right-3 w-8 h-8 rounded-full flex items-center justify-center text-ink-soft hover:bg-rose-whisper hover:text-ink-primary transition"
              >
                <X className="w-4 h-4" />
              </button>
            )}

            <div className="flex flex-col items-center text-center">
              <div className={`w-14 h-14 rounded-2xl ${iconBg} flex items-center justify-center mb-3`}>
                <Icon className="w-7 h-7" />
              </div>
              <h2 id="confirm-title" className="font-display text-xl text-ink-primary leading-tight">
                {state.title}
              </h2>
              {state.description && (
                <p className="text-sm text-ink-secondary mt-2 whitespace-pre-line">
                  {state.description}
                </p>
              )}
            </div>

            {requiresType && (
              <div className="mt-4">
                <p className="text-xs text-ink-soft mb-1.5">
                  Para confirmar, escribí: <strong className="text-ink-primary">{state.typeToConfirm}</strong>
                </p>
                <input
                  className="input !h-10 !text-sm"
                  value={typed}
                  onChange={(e) => setTyped(e.target.value)}
                  autoFocus
                />
              </div>
            )}

            <div className="flex flex-col-reverse sm:flex-row gap-2 mt-6">
              <button
                onClick={() => close(false)}
                disabled={busy}
                className="flex-1 px-4 py-2.5 rounded-full font-semibold text-sm text-ink-secondary bg-rose-whisper hover:bg-rose-pastel transition disabled:opacity-50"
              >
                {state.cancelLabel ?? "Cancelar"}
              </button>
              <button
                onClick={() => {
                  if (!typeOk) return;
                  setBusy(true);
                  close(true);
                }}
                disabled={busy || !typeOk}
                className={`flex-1 px-4 py-2.5 rounded-full font-semibold text-sm transition disabled:opacity-50 disabled:cursor-not-allowed flex items-center justify-center gap-2 ${confirmBtnCls}`}
              >
                {busy && <Loader2 className="w-4 h-4 animate-spin" />}
                {state.confirmLabel ?? "Confirmar"}
              </button>
            </div>
          </div>
        </div>
      )}
    </ConfirmContext.Provider>
  );
}
