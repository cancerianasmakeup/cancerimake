import StoreStatusForm from "@/components/StoreStatusForm";
import { createSupabaseServer } from "@/lib/supabase-server";
import { DEFAULT_STORE_STATUS } from "@cancerianas/shared";
import type { StoreStatusConfig } from "@cancerianas/shared";

export const dynamic = "force-dynamic";

export default async function AdminStorePage() {
  const supabase = await createSupabaseServer();

  const [{ data: settings }, { count: subscribersCount }] = await Promise.all([
    supabase.from("site_settings").select("value").eq("key", "store_status").maybeSingle(),
    supabase.from("store_subscribers").select("*", { count: "exact", head: true }),
  ]);

  const config: StoreStatusConfig = {
    ...DEFAULT_STORE_STATUS,
    ...(settings?.value as Partial<StoreStatusConfig> | undefined),
  };

  return (
    <div className="max-w-4xl">
      <h1 className="font-display text-3xl md:text-4xl text-ink-primary mb-2">Tienda de oportunidades</h1>
      <p className="text-ink-secondary mb-6">
        Programá los drops, abrí o cerrá la tienda manualmente, y editá los mensajes que ven las
        clientas que llegan desde TikTok.
      </p>
      <StoreStatusForm initial={config} subscribersCount={subscribersCount ?? 0} />
    </div>
  );
}
