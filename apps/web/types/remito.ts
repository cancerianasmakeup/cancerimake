export interface RemitItem {
  id: string;
  product: string;
  quantity: number;
  price: number;
}

export interface Remito {
  id: string;
  createdAt: string;
  clientName: string;
  clientEmail: string;
  clientPhone: string;
  items: RemitItem[];
  notes: string;
  status: "draft" | "sent";
}
