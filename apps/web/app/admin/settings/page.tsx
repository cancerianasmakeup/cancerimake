import SettingsForm from "@/components/SettingsForm";
import { createSupabaseServer } from "@/lib/supabase-server";

export const dynamic = "force-dynamic";

export default async function AdminSettingsPage() {
  const supabase = await createSupabaseServer();
  const { data: settings } = await supabase.from("site_settings").select("*");
  const map: Record<string, any> = {};
  (settings ?? []).forEach((s: any) => {
    map[s.key] = s.value;
  });

  return (
    <div className="max-w-4xl">
      <h1 className="font-display text-3xl md:text-4xl text-ink-primary mb-2">Configuración</h1>
      <p className="text-ink-secondary mb-6">
        Datos del remitente para envíos, recargos, modo de Andreani.
      </p>
      <SettingsForm initial={map} />
    </div>
  );
}
