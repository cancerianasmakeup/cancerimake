import NewShipmentForm from "@/components/NewShipmentForm";
import { createSupabaseServer } from "@/lib/supabase-server";

export const dynamic = "force-dynamic";

export default async function NewShipmentPage() {
  const supabase = await createSupabaseServer();
  // Pre-fetch users (clientas) for the selector
  const { data: users } = await supabase
    .from("profiles")
    .select("id, full_name, email, phone, role")
    .order("full_name", { nullsFirst: false });

  return (
    <div className="max-w-3xl">
      <h1 className="font-display text-3xl md:text-4xl text-ink-primary mb-2">
        Nuevo envío
      </h1>
      <p className="text-ink-secondary mb-6">
        Asignás un envío a una clienta. Cuando guardes, ella recibe una notificación para completar
        su dirección y pagar.
      </p>
      <NewShipmentForm users={users ?? []} />
    </div>
  );
}
