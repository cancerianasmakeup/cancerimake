// Labels en castellano para los estados de shipments.

export type ShipmentStatusLabel = {
  label: string;
  emoji: string;
  /** Clases tailwind para el badge. */
  badge: string;
};

export const SHIPMENT_STATUS_LABELS: Record<string, ShipmentStatusLabel> = {
  pending_address:      { label: "Esperando dirección",         emoji: "📝", badge: "bg-warning/30 text-ink-primary" },
  pending_custom_quote: { label: "Esperando cotización",        emoji: "🤝", badge: "bg-rose-deep/15 text-rose-deep" },
  pending_quote:        { label: "Esperando cotización",        emoji: "🤝", badge: "bg-rose-deep/15 text-rose-deep" },
  pending_payment:      { label: "Esperando pago",              emoji: "⏳", badge: "bg-warning/30 text-ink-primary" },
  pending_approval:     { label: "Aprobando comprobante",       emoji: "🔔", badge: "bg-rose-deep/15 text-rose-deep" },
  paid:                 { label: "Pago confirmado",             emoji: "💚", badge: "bg-success/30 text-success" },
  label_generated:      { label: "Etiqueta lista",              emoji: "🏷️", badge: "bg-rose-deep text-white" },
  dispatched:           { label: "Despachado",                  emoji: "📦", badge: "bg-rose-medium text-ink-primary" },
  in_transit:           { label: "En tránsito",                 emoji: "🚚", badge: "bg-rose-pastel text-rose-deep" },
  out_for_delivery:     { label: "En reparto",                  emoji: "🚪", badge: "bg-rose-pastel text-rose-deep" },
  delivered:            { label: "Entregado",                   emoji: "✅", badge: "bg-success/30 text-success" },
  returned:             { label: "Devuelto",                    emoji: "↩️", badge: "bg-error/20 text-ink-primary" },
  failed:               { label: "Falló entrega",               emoji: "⚠️", badge: "bg-error/30 text-error" },
  cancelled:            { label: "Cancelado",                   emoji: "❌", badge: "bg-ink-soft/15 text-ink-soft" },
};

export function getShipmentStatusLabel(status: string): ShipmentStatusLabel {
  return SHIPMENT_STATUS_LABELS[status]
    ?? { label: status, emoji: "📦", badge: "bg-rose-pastel text-rose-deep" };
}
