// Mapeo de los valores del enum order_status (DB) a labels en castellano.
// Se usa tanto en /orders (lista) como en /orders/[id] (detalle) y en el admin.

export type OrderStatusLabel = {
  label: string;
  /** Clases tailwind para el badge — usar en chips. */
  badge: string;
};

export const ORDER_STATUS_LABELS: Record<string, OrderStatusLabel> = {
  pending:          { label: "Esperando pago",         badge: "bg-warning/15 text-warning" },
  pending_approval: { label: "Pendiente de aprobación", badge: "bg-rose-deep/15 text-rose-deep" },
  paid:             { label: "Pago confirmado",        badge: "bg-success/15 text-success" },
  preparing:        { label: "En preparación",         badge: "bg-rose-pastel text-rose-deep" },
  shipped:          { label: "Enviado",                badge: "bg-success/20 text-success" },
  delivered:        { label: "Entregado",              badge: "bg-success/30 text-success" },
  cancelled:        { label: "Cancelado",              badge: "bg-error/15 text-error" },
};

export function getOrderStatusLabel(status: string): OrderStatusLabel {
  return ORDER_STATUS_LABELS[status] ?? { label: status, badge: "bg-rose-pastel text-rose-deep" };
}
