import { createSupabaseServer } from "@/lib/supabase-server";
import CustomersExplorer, { type CustomerRow } from "./CustomersExplorer";

export const dynamic = "force-dynamic";

type Profile = {
  id: string;
  email: string;
  full_name: string | null;
  first_name: string | null;
  last_name: string | null;
  phone: string | null;
  created_at: string;
};

type Subscriber = {
  id: string;
  email: string | null;
  phone: string | null;
  source: string | null;
  created_at: string;
};

type Order = {
  user_id: string;
  total: string | number;
  status: string;
  created_at: string;
};

const PAID_STATUSES = new Set(["paid", "preparing", "shipped", "delivered"]);

export default async function AdminCustomersPage() {
  const supabase = await createSupabaseServer();
  const [{ data: profilesData }, { data: subsData }, { data: ordersData }] = await Promise.all([
    supabase
      .from("profiles")
      .select("id, email, full_name, first_name, last_name, phone, created_at")
      .eq("role", "customer")
      .order("created_at", { ascending: false }),
    supabase
      .from("store_subscribers")
      .select("id, email, phone, source, created_at")
      .order("created_at", { ascending: false }),
    supabase
      .from("orders")
      .select("user_id, total, status, created_at"),
  ]);

  const profiles: Profile[] = profilesData ?? [];
  const subscribers: Subscriber[] = subsData ?? [];
  const orders: Order[] = ordersData ?? [];

  // Stats por cliente
  const statsByUser = new Map<string, {
    orders_count: number;
    paid_count: number;
    total_spent: number;
    last_order_at: string | null;
  }>();
  for (const o of orders) {
    if (!o.user_id) continue;
    const cur = statsByUser.get(o.user_id) ?? { orders_count: 0, paid_count: 0, total_spent: 0, last_order_at: null };
    cur.orders_count += 1;
    if (PAID_STATUSES.has(o.status)) {
      cur.paid_count += 1;
      cur.total_spent += Number(o.total) || 0;
    }
    if (!cur.last_order_at || o.created_at > cur.last_order_at) cur.last_order_at = o.created_at;
    statsByUser.set(o.user_id, cur);
  }

  const profileEmails = new Set(profiles.map(p => (p.email ?? "").toLowerCase().trim()));

  const accountsRows: CustomerRow[] = profiles.map(p => {
    const s = statsByUser.get(p.id);
    return {
      source: "account",
      id: p.id,
      email: p.email,
      name: [p.first_name, p.last_name].filter(Boolean).join(" ") || p.full_name || "",
      phone: p.phone || "",
      created_at: p.created_at,
      origin: null,
      orders_count: s?.orders_count ?? 0,
      paid_count: s?.paid_count ?? 0,
      total_spent: s?.total_spent ?? 0,
      last_order_at: s?.last_order_at ?? null,
    };
  });

  const subscriberRows: CustomerRow[] = subscribers.map(s => ({
    source: profileEmails.has((s.email ?? "").toLowerCase().trim()) ? "both" : "subscriber",
    id: s.id,
    email: s.email || "",
    name: "",
    phone: s.phone || "",
    created_at: s.created_at,
    origin: s.source,
    orders_count: 0,
    paid_count: 0,
    total_spent: 0,
    last_order_at: null,
  }));

  return (
    <CustomersExplorer
      accountsRows={accountsRows}
      subscriberRows={subscriberRows}
    />
  );
}
