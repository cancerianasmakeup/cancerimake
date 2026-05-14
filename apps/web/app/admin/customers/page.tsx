import { createSupabaseServer } from "@/lib/supabase-server";

export const dynamic = "force-dynamic";

type Customer = {
  id: string;
  email: string;
  full_name: string | null;
  first_name: string | null;
  last_name: string | null;
  phone: string | null;
  created_at: string;
};

export default async function AdminCustomers() {
  const supabase = await createSupabaseServer();
  const { data: customers } = await supabase
    .from("profiles")
    .select("id, email, full_name, first_name, last_name, phone, created_at")
    .eq("role", "customer")
    .order("created_at", { ascending: false })
    .limit(200);

  return (
    <div className="max-w-6xl">
      <div className="mb-8">
        <h1 className="font-display text-3xl md:text-4xl text-ink-primary">Clientas</h1>
        <p className="text-ink-secondary mt-1">{customers?.length ?? 0} registradas</p>
      </div>

      <div className="card overflow-x-auto p-0">
        <table className="w-full text-sm">
          <thead className="bg-rose-whisper">
            <tr className="text-left text-ink-soft uppercase text-xs">
              <th className="p-4">Nombre</th>
              <th className="p-4">Apellido</th>
              <th className="p-4">Email</th>
              <th className="p-4">Teléfono</th>
              <th className="p-4">Registrada</th>
            </tr>
          </thead>
          <tbody>
            {(customers as Customer[] | null)?.map(c => (
              <tr key={c.id} className="border-t border-rose-pastel hover:bg-rose-whisper/50">
                <td className="p-4 font-semibold text-ink-primary">{c.first_name || "—"}</td>
                <td className="p-4 font-semibold text-ink-primary">{c.last_name || "—"}</td>
                <td className="p-4 text-ink-secondary">{c.email}</td>
                <td className="p-4 text-ink-secondary">{c.phone || "—"}</td>
                <td className="p-4 text-ink-soft text-xs">
                  {new Date(c.created_at).toLocaleDateString("es-AR")}
                </td>
              </tr>
            ))}
            {(!customers || customers.length === 0) && (
              <tr><td colSpan={5} className="text-center py-16 text-ink-soft">Todavía no hay clientas registradas.</td></tr>
            )}
          </tbody>
        </table>
      </div>
    </div>
  );
}
