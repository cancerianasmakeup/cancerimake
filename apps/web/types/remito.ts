export interface RemitItem {
  id: string;
  product: string;
  quantity: number;
  price: number;
  // Metadatos opcionales cuando el item viene del catálogo de la tienda
  productId?: string; // id del producto en la DB (para descontar stock disponible en la sesión)
  wholesale?: boolean; // true si el precio aplicado es el de por mayor
}

export interface Remito {
  id: string;
  createdAt: string;
  clientName: string;
  clientEmail: string;
  clientPhone: string;
  items: RemitItem[];
  notes: string;
  deposit: number;
  status: "draft" | "sent";
}
