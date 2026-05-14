"use client";

import { useEffect, useState } from "react";
import { Upload, MessageCircle, CheckCircle2, Loader2, X } from "lucide-react";
import { toast } from "sonner";
import { createSupabaseBrowser } from "@/lib/supabase-browser";

type EntityType = "order" | "shipment";

type Props = {
  /** Tipo de entidad a la que se asocia el comprobante. */
  entityType: EntityType;
  /** ID de la entidad (order_id o shipment_id). */
  entityId: string;
  /** ID del usuario dueño de la entidad — define la carpeta en Storage. */
  userId: string;
  /** Número de orden o referencia visible (para el template de WhatsApp). */
  reference: string;
  /** Monto del pago para el template de WhatsApp. */
  amount: number;
  /** WhatsApp del negocio. Si está vacío, se oculta la opción WA. */
  whatsappNumber?: string;
  /** Etiqueta del concepto ("la orden", "el envío"). */
  label?: string;
  /** Si ya hay un comprobante subido (URL/path) — pasa al estado "ya enviado". */
  existingProofUrl?: string | null;
  /** Si el cliente ya marcó "envié por WhatsApp" — pasa al estado "ya enviado". */
  existingViaWhatsapp?: boolean;
  /** Estado actual (para gating de UI). */
  currentStatus?: string;
  /** Callback luego de que se envió el comprobante / se marcó WA, para refrescar. */
  onSubmitted?: () => void;
};

const BUCKET = "payment-proofs";

export default function PaymentProofUploader({
  entityType,
  entityId,
  userId,
  reference,
  amount,
  whatsappNumber,
  label = "el pago",
  existingProofUrl,
  existingViaWhatsapp,
  currentStatus,
  onSubmitted,
}: Props) {
  const supabase = createSupabaseBrowser();
  const [uploading, setUploading] = useState(false);
  const [signedUrl, setSignedUrl] = useState<string | null>(null);
  const [submitted, setSubmitted] = useState(!!existingProofUrl || !!existingViaWhatsapp);

  // Si ya hay comprobante subido, generamos signed URL para preview
  useEffect(() => {
    if (!existingProofUrl) { setSignedUrl(null); return; }
    let cancelled = false;
    supabase.storage
      .from(BUCKET)
      .createSignedUrl(existingProofUrl, 60 * 60)
      .then(({ data, error }) => {
        if (cancelled) return;
        if (!error && data?.signedUrl) setSignedUrl(data.signedUrl);
      });
    return () => { cancelled = true; };
  }, [existingProofUrl, supabase]);

  async function handleFile(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    e.target.value = ""; // permitir re-elegir el mismo archivo
    if (!file) return;
    if (file.size > 10 * 1024 * 1024) {
      toast.error("El archivo supera los 10 MB");
      return;
    }
    setUploading(true);
    try {
      const ext = file.name.split(".").pop()?.toLowerCase() || "jpg";
      const safeExt = ["jpg", "jpeg", "png", "webp", "pdf"].includes(ext) ? ext : "jpg";
      const path = `${entityType}s/${userId}/${entityId}/comprobante-${Date.now()}.${safeExt}`;

      const { error: upErr } = await supabase.storage
        .from(BUCKET)
        .upload(path, file, { upsert: true, contentType: file.type });
      if (upErr) throw upErr;

      // Update DB: payment_proof_url + payment_proof_at + status si aplica
      const table = entityType === "order" ? "orders" : "shipments";
      const updates: Record<string, any> = {
        payment_proof_url: path,
        payment_proof_at: new Date().toISOString(),
        payment_proof_via_whatsapp: false,
      };
      // Avanzamos al estado de aprobación si corresponde
      if (entityType === "order" && currentStatus === "pending") {
        updates.status = "pending_approval";
      }
      if (entityType === "shipment" && currentStatus === "pending_payment") {
        updates.status = "pending_approval";
      }

      const { error: dbErr } = await supabase
        .from(table)
        .update(updates)
        .eq("id", entityId);
      if (dbErr) throw dbErr;

      toast.success("Comprobante recibido 🌸");
      setSubmitted(true);
      onSubmitted?.();
    } catch (err: any) {
      toast.error("No se pudo subir: " + (err?.message ?? "error"));
    } finally {
      setUploading(false);
    }
  }

  async function handleWhatsApp() {
    if (!whatsappNumber) return;
    setUploading(true);
    try {
      const table = entityType === "order" ? "orders" : "shipments";
      const updates: Record<string, any> = {
        payment_proof_via_whatsapp: true,
        payment_proof_at: new Date().toISOString(),
      };
      if (entityType === "order" && currentStatus === "pending") {
        updates.status = "pending_approval";
      }
      if (entityType === "shipment" && currentStatus === "pending_payment") {
        updates.status = "pending_approval";
      }
      const { error } = await supabase.from(table).update(updates).eq("id", entityId);
      if (error) throw error;

      // Abrir WhatsApp con el template
      const phone = whatsappNumber.replace(/\D/g, "");
      const text = encodeURIComponent(
        `Hola! Acabo de pagar ${label} ORDEN ${reference} por $${amount.toLocaleString("es-AR")}. ` +
        `Adjunto comprobante de pago.`
      );
      window.open(`https://wa.me/${phone}?text=${text}`, "_blank");

      toast.success("Marcaste que mandás por WhatsApp. Esperamos tu mensaje 🌸");
      setSubmitted(true);
      onSubmitted?.();
    } catch (err: any) {
      toast.error("No se pudo guardar: " + (err?.message ?? "error"));
    } finally {
      setUploading(false);
    }
  }

  // ─── Render: estado "ya enviado" ────────────────────────────
  if (submitted) {
    return (
      <div className="card border-2 border-success/40 bg-success/5 space-y-3">
        <div className="flex items-start gap-3">
          <CheckCircle2 className="w-6 h-6 text-success flex-shrink-0 mt-0.5" />
          <div className="flex-1 min-w-0">
            <p className="font-semibold text-ink-primary">Comprobante recibido 🌸</p>
            <p className="text-sm text-ink-soft mt-0.5">
              {existingViaWhatsapp || (!existingProofUrl && submitted && !signedUrl)
                ? "Marcaste que lo envías por WhatsApp. Esperamos tu mensaje."
                : "Tu pago está en revisión. Te avisamos cuando lo aprobemos (suele ser dentro del día)."}
            </p>
            {signedUrl && (
              <a
                href={signedUrl}
                target="_blank"
                rel="noopener"
                className="inline-block mt-2 text-xs text-rose-deep hover:underline font-semibold"
              >
                Ver comprobante subido →
              </a>
            )}
          </div>
        </div>
      </div>
    );
  }

  // ─── Render: estado "pendiente, mostrar opciones" ───────────
  return (
    <div className="card border-2 border-rose-deep/30 bg-white space-y-4">
      <div>
        <h3 className="font-display text-lg text-ink-primary">Confirmá tu pago</h3>
        <p className="text-sm text-ink-soft">
          Elegí cómo querés enviar el comprobante. Una vez que lo recibamos lo
          revisamos y avanzamos con tu pedido.
        </p>
      </div>

      <div className="grid gap-3 sm:grid-cols-2">
        {/* Subir comprobante */}
        <label
          className={`relative flex flex-col items-center justify-center gap-2 rounded-2xl border-2 border-dashed border-rose-medium/40 bg-rose-whisper/40 px-4 py-6 cursor-pointer hover:border-rose-deep hover:bg-rose-whisper transition ${
            uploading ? "opacity-60 pointer-events-none" : ""
          }`}
        >
          <input
            type="file"
            accept="image/png, image/jpeg, image/webp, application/pdf"
            onChange={handleFile}
            className="absolute inset-0 opacity-0 cursor-pointer"
            disabled={uploading}
          />
          {uploading ? (
            <Loader2 className="w-8 h-8 text-rose-deep animate-spin" />
          ) : (
            <Upload className="w-8 h-8 text-rose-deep" />
          )}
          <p className="font-semibold text-sm text-ink-primary text-center">
            {uploading ? "Subiendo..." : "Subir comprobante"}
          </p>
          <p className="text-[11px] text-ink-soft text-center">JPG, PNG o PDF (máx 10 MB)</p>
        </label>

        {/* Mandar por WhatsApp */}
        {whatsappNumber ? (
          <button
            type="button"
            onClick={handleWhatsApp}
            disabled={uploading}
            className="flex flex-col items-center justify-center gap-2 rounded-2xl border-2 border-[#25D366]/40 bg-[#25D366]/5 px-4 py-6 hover:border-[#25D366] hover:bg-[#25D366]/10 transition disabled:opacity-50"
          >
            <MessageCircle className="w-8 h-8 text-[#25D366]" />
            <p className="font-semibold text-sm text-ink-primary">Enviar por WhatsApp</p>
            <p className="text-[11px] text-ink-soft text-center">Te abrimos el chat con el mensaje listo</p>
          </button>
        ) : (
          <div className="flex flex-col items-center justify-center gap-1 rounded-2xl border-2 border-dashed border-rose-pastel bg-rose-whisper/30 px-4 py-6 opacity-50">
            <X className="w-6 h-6 text-ink-soft" />
            <p className="text-xs text-ink-soft text-center">El admin no configuró WhatsApp todavía</p>
          </div>
        )}
      </div>
    </div>
  );
}
