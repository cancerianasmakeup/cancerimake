// Tipos compartidos entre web y mobile
// Refleja el schema de Supabase.

export type UserRole = "customer" | "admin";
export type ProductStatus = "active" | "draft" | "archived";
export type OrderStatus = "pending" | "paid" | "preparing" | "shipped" | "delivered" | "cancelled";
export type OrderSource = "catalog" | "live";
export type LiveEventType = "capsulas" | "sobres" | "bolsitas";
export type LiveEventStatus = "draft" | "active" | "paused" | "finished";
export type LivePurchaseStatus = "queued" | "paying" | "paid" | "expired" | "cancelled" | "pending_recovery";

export interface Profile {
  id: string;
  email: string;
  full_name: string | null;
  phone: string | null;
  role: UserRole;
  avatar_url: string | null;
  created_at: string;
}

export interface Address {
  id: string;
  user_id: string;
  full_name: string;
  street: string;
  street_number: string | null;
  apartment: string | null;
  city: string;
  province: string;
  zip_code: string;
  phone: string | null;
  is_default: boolean;
}

export interface Category {
  id: string;
  name: string;
  slug: string;
  parent_id: string | null;
  image_url: string | null;
  display_order: number;
  is_active: boolean;
  icon: string;
  gradient_from: string;
  gradient_to: string;
  description: string | null;
}

export interface Product {
  id: string;
  name: string;
  slug: string;
  description: string | null;
  category_id: string | null;
  price: number;
  compare_price: number | null;
  cost: number; // costo interno (para margen, no se muestra al cliente). Default 0.
  stock: number;
  sku: string | null;
  images: string[];
  videos: string[]; // URLs a archivos de video del fabricante (.mp4/.webm) o embeds
  status: ProductStatus;
  is_featured: boolean;
  weight_grams: number | null;
  length_cm: number | null;
  width_cm: number | null;
  height_cm: number | null;
  created_at: string;
  category?: Category;
}

export interface ProductVariant {
  id: string;
  product_id: string;
  name: string;
  attributes: Record<string, string>;
  price_diff: number;
  stock: number;
  sku: string | null;
  image_url: string | null;
}

export interface CartItem {
  id: string;
  cart_id: string;
  product_id: string;
  variant_id: string | null;
  quantity: number;
  unit_price: number;
  product?: Product;
  variant?: ProductVariant;
}

export interface Order {
  id: string;
  user_id: string;
  order_number: string;
  status: OrderStatus;
  source: OrderSource;
  subtotal: number;
  shipping_cost: number;
  total: number;
  shipping_address: any;
  notes: string | null;
  mp_payment_id: string | null;
  mp_status: string | null;
  created_at: string;
  paid_at: string | null;
  items?: OrderItem[];
}

export interface OrderItem {
  id: string;
  order_id: string;
  product_id: string | null;
  variant_id: string | null;
  live_event_id: string | null;
  live_offer_id: string | null;
  description: string;
  image_url: string | null;
  quantity: number;
  unit_price: number;
  subtotal: number;
}

export interface LiveEvent {
  id: string;
  type: LiveEventType;
  title: string;
  description: string | null;
  status: LiveEventStatus;
  cover_image: string | null;
  total_revenue: number;
  total_buyers: number;
  queue_open: boolean;
  started_at: string | null;
  finished_at: string | null;
  created_by: string | null;
  created_at: string;
  notes?: string | null;
  auto_save_pending?: boolean;
  offers?: LiveOffer[];
}

export interface LiveEventStats {
  id: string;
  title: string;
  type: LiveEventType;
  status: LiveEventStatus;
  cover_image: string | null;
  started_at: string | null;
  finished_at: string | null;
  created_at: string;
  paid_buyers: number;
  paid_count: number;
  pending_count: number;
  abandoned_count: number;
  total_attempts: number;
  revenue: number;
  pending_revenue: number;
}

export interface LiveOffer {
  id: string;
  event_id: string;
  name: string;
  description: string | null;
  unit_count: number;
  price: number;
  total_stock: number;
  sold_count: number;
  reserved_count: number;
  released_count: number;
  display_order: number;
  is_active: boolean;
  image_url: string | null;
}

export interface LivePurchase {
  id: string;
  event_id: string;
  offer_id: string;
  user_id: string;
  order_id: string | null;
  status: LivePurchaseStatus;
  queue_position: number | null;
  amount: number;
  reserved_until: string | null;
  mp_init_point: string | null;
  mp_payment_id: string | null;
  paid_at: string | null;
  created_at: string;
  updated_at?: string;
  admin_notes?: string | null;
  recovery_notified_at?: string | null;
  marked_by?: string | null;
  offer?: LiveOffer;
  event?: LiveEvent;
}

// ============================================================
// SHIPMENTS
// ============================================================
export type ShipmentStatus =
  | "pending_address"
  | "pending_custom_quote"
  | "pending_payment"
  | "paid"
  | "label_generated"
  | "dispatched"
  | "in_transit"
  | "out_for_delivery"
  | "delivered"
  | "returned"
  | "failed"
  | "cancelled";

export type ShipmentDestinationType = "domicilio" | "sucursal";
export type ShipmentCarrier = "andreani" | "correo_argentino" | "personalizado";
export type PendingPackageStatus = "pending" | "shipped" | "cancelled";

export const CARRIER_LABELS: Record<ShipmentCarrier, string> = {
  andreani: "Andreani",
  correo_argentino: "Correo Argentino",
  personalizado: "Envío personalizado",
};

export interface ShipmentAddress {
  nombre_completo: string;
  documento: string;
  telefono: string;
  codigoPostal: string;
  calle: string;
  numero: string;
  piso?: string;
  depto?: string;
  localidad: string;
  region: string;
  referencias?: string;
}

export interface ShipmentBranch {
  id: string;
  nombre: string;
  direccion: string;
  localidad: string;
  region: string;
  codigoPostal: string;
}

export interface Shipment {
  id: string;
  user_id: string;
  order_id: string | null;
  live_event_id: string | null;
  status: ShipmentStatus;
  carrier: ShipmentCarrier;
  description: string;
  weight_grams: number;
  length_cm: number | null;
  width_cm: number | null;
  height_cm: number | null;
  declared_value: number;
  internal_notes: string | null;
  destination_type: ShipmentDestinationType | null;
  destination_address: ShipmentAddress | null;
  destination_branch: ShipmentBranch | null;
  cost_quoted: number | null;
  cost_charged: number | null;
  mp_preference_id: string | null;
  mp_payment_id: string | null;
  paid_at: string | null;
  andreani_tracking_number: string | null;
  andreani_remito: string | null;
  andreani_label_url: string | null;
  andreani_estimated_delivery: string | null;
  andreani_last_status: string | null;
  andreani_last_polled_at: string | null;
  // Generic multi-carrier columns (preferred when reading)
  carrier_tracking_number?: string | null;
  carrier_remito?: string | null;
  carrier_label_url?: string | null;
  carrier_estimated_delivery?: string | null;
  carrier_last_status?: string | null;
  carrier_last_polled_at?: string | null;
  carrier_response?: any;
  // Cotización personalizada (carrier === 'personalizado')
  custom_quote_amount?: number | null;
  custom_quote_message?: string | null;
  custom_quoted_at?: string | null;
  custom_quoted_by?: string | null;
  // Contacto del comprador (para mandar el link sin sesión activa en otro device)
  contact_email?: string | null;
  contact_phone?: string | null;
  link_sent_at?: string | null;
  created_by: string | null;
  created_at: string;
  updated_at: string;
  dispatched_at: string | null;
  delivered_at: string | null;
}

export interface ShipmentEvent {
  id: string;
  shipment_id: string;
  status: ShipmentStatus;
  source: "admin" | "customer" | "andreani" | "system";
  message: string | null;
  payload: any;
  created_at: string;
  created_by: string | null;
}

// ============================================================
// PENDING PACKAGES (paquetes acumulados por clienta esperando despacho)
// ============================================================
export interface PendingPackage {
  id: string;
  user_id: string;
  live_event_id: string | null;
  live_offer_id: string | null;
  live_purchase_id: string | null;
  order_id: string | null;
  description: string;
  unit_count: number;
  amount: number;
  image_url: string | null;
  status: PendingPackageStatus;
  shipment_id: string | null;
  notes: string | null;
  created_by: string | null;
  created_at: string;
  updated_at: string;
  shipped_at: string | null;
  cancelled_at: string | null;
}

export interface PendingPackagesByCustomer {
  user_id: string;
  full_name: string | null;
  email: string;
  phone: string | null;
  pending_count: number;
  pending_total: number;
  oldest_at: string;
  newest_at: string;
  package_ids: string[];
}

export interface ShippingOriginSettings {
  nombre_comercial: string;
  razon_social: string;
  cuit: string;
  codigo_postal: string;
  calle: string;
  numero: string;
  piso?: string;
  depto?: string;
  localidad: string;
  region: string;
  telefono: string;
  email: string;
}

// Helpers
export function offerAvailable(offer: LiveOffer, event?: LiveEvent): number {
  if (event?.type === "sobres") {
    return offer.released_count - offer.sold_count - offer.reserved_count;
  }
  return offer.total_stock - offer.sold_count - offer.reserved_count;
}

export function formatPrice(amount: number): string {
  return new Intl.NumberFormat("es-AR", {
    style: "currency",
    currency: "ARS",
    minimumFractionDigits: 0,
  }).format(amount);
}
