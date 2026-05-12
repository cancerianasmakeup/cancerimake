import Link from "next/link";
import { ArrowLeft, Mail, Phone, Download } from "lucide-react";
import { createSupabaseServer } from "@/lib/supabase-server";

export const dynamic = "force-dynamic";

export default async function SubscribersPage() {
  const supabase = await createSupabaseServer();
  const { data: subs } = await supabase
    .from("store_subscribers")
    .select("*")
    .order("created_at", { ascending: false })
    .limit(500);

  const list = subs ?? [];

  return (
    <div className="max-w-4xl">
      <Link href="/admin/store" className="inline-flex items-center gap-1 text-sm text-rose-deep mb-3 hover:underline">
        <ArrowLeft className="w-4 h-4" /> Volver a Tienda
      </Link>
      <div className="flex items-center justify-between flex-wrap gap-3 mb-6">
        <div>
          <h1 className="font-display text-3xl md:text-4xl text-ink-primary">Suscriptas al próximo drop</h1>
          <p className="text-ink-secondary">
            {list.length} {list.length === 1 ? "persona dejó" : "personas dejaron"} su contacto.
          </p>
        </div>
        {list.length > 0 && (
          <a
            href={`data:text/csv;charset=utf-8,${encodeURIComponent(toCsv(list))}`}
            download={`suscriptoras-${new Date().toISOString().slice(0, 10)}.csv`}
            className="btn-secondary text-sm"
          >
            <Download className="w-4 h-4" /> Exportar CSV
          </a>
        )}
      </div>

      {list.length === 0 ? (
        <div className="card text-center py-16">
          <div className="text-5xl mb-3">📭</div>
          <p className="text-ink-secondary">Todavía nadie se anotó. Cuando entren a la web con la
          tienda cerrada van a poder dejar su contacto.</p>
        </div>
      ) : (
        <div className="card overflow-x-auto p-0">
          <table className="w-full text-sm">
            <thead className="border-b border-rose-pastel bg-rose-whisper/40">
              <tr className="text-left">
                <th className="px-4 py-3 font-semibold text-ink-secondary">Email</th>
                <th className="px-4 py-3 font-semibold text-ink-secondary">WhatsApp</th>
                <th className="px-4 py-3 font-semibold text-ink-secondary">Origen</th>
                <th className="px-4 py-3 font-semibold text-ink-secondary">Fecha</th>
              </tr>
            </thead>
            <tbody>
              {list.map((s: any) => (
                <tr key={s.id} className="border-b border-rose-pastel/50 last:border-0">
                  <td className="px-4 py-3">
                    {s.email ? (
                      <a href={`mailto:${s.email}`} className="inline-flex items-center gap-1 text-ink-primary hover:text-rose-deep">
                        <Mail className="w-3.5 h-3.5 text-ink-soft" />
                        {s.email}
                      </a>
                    ) : (
                      <span className="text-ink-soft">—</span>
                    )}
                  </td>
                  <td className="px-4 py-3">
                    {s.phone ? (
                      <a href={`https://wa.me/${onlyDigits(s.phone)}`} target="_blank" rel="noopener" className="inline-flex items-center gap-1 text-ink-primary hover:text-rose-deep">
                        <Phone className="w-3.5 h-3.5 text-ink-soft" />
                        {s.phone}
                      </a>
                    ) : (
                      <span className="text-ink-soft">—</span>
                    )}
                  </td>
                  <td className="px-4 py-3 text-ink-soft">{s.source}</td>
                  <td className="px-4 py-3 text-ink-soft whitespace-nowrap">
                    {new Date(s.created_at).toLocaleDateString("es-AR", {
                      day: "2-digit", month: "short", hour: "2-digit", minute: "2-digit",
                    })}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}

function toCsv(rows: any[]): string {
  const head = "email,phone,source,created_at";
  const body = rows
    .map((r) =>
      [r.email ?? "", r.phone ?? "", r.source ?? "", r.created_at ?? ""]
        .map((v) => `"${String(v).replace(/"/g, '""')}"`)
        .join(",")
    )
    .join("\n");
  return `${head}\n${body}`;
}

function onlyDigits(s: string): string {
  return s.replace(/\D/g, "");
}
