"use client";

import { useEffect } from "react";
import { X } from "lucide-react";
import AuthForm from "./AuthForm";
import { BRAND } from "@/lib/brand";

type Props = {
  open: boolean;
  onClose: () => void;
  /** Llamado después de un login exitoso (después de cerrar el modal el padre
   *  puede reintentar la acción que disparó el modal, ej. agregar al carrito). */
  onSuccess?: () => void;
  /** Mensaje opcional arriba del form (ej. "Iniciá sesión para agregar al carrito"). */
  title?: string;
};

export default function LoginModal({ open, onClose, onSuccess, title }: Props) {
  // Cerrar con ESC + bloquear scroll del body mientras está abierto.
  useEffect(() => {
    if (!open) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") onClose();
    };
    document.addEventListener("keydown", onKey);
    const prevOverflow = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    return () => {
      document.removeEventListener("keydown", onKey);
      document.body.style.overflow = prevOverflow;
    };
  }, [open, onClose]);

  if (!open) return null;

  return (
    <div
      className="fixed inset-0 z-[100] flex items-center justify-center px-4 py-6 overflow-y-auto bg-ink-primary/60 backdrop-blur-sm"
      onClick={onClose}
      role="dialog"
      aria-modal="true"
    >
      <div
        className="relative w-full max-w-md bg-white rounded-3xl shadow-2xl p-6 md:p-8 my-auto"
        onClick={e => e.stopPropagation()}
      >
        <button
          type="button"
          onClick={onClose}
          aria-label="Cerrar"
          className="absolute top-3 right-3 w-9 h-9 rounded-full flex items-center justify-center text-ink-soft hover:bg-rose-whisper hover:text-rose-deep transition"
        >
          <X className="w-5 h-5" />
        </button>

        <div className="text-center mb-5">
          <img
            src={BRAND.logoUrl}
            alt={BRAND.name}
            className="h-10 mx-auto mb-3 object-contain"
          />
          {title && <p className="text-ink-secondary text-sm">{title}</p>}
        </div>

        <AuthForm
          onSuccess={() => {
            onSuccess?.();
            onClose();
          }}
        />
      </div>
    </div>
  );
}
