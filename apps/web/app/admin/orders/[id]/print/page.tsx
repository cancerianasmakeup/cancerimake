import { notFound } from "next/navigation";
import { createSupabaseServer } from "@/lib/supabase-server";
import { formatPrice } from "@cancerianas/shared";
import PrintTrigger from "./PrintTrigger";

export const dynamic = "force-dynamic";

const CARRIER_LABEL: Record<string, string> = {
  correo_argentino: "Correo Argentino",
  andreani: "Andreani",
  personalizado: "Envío personalizado",
};

export default async function OrderPrintPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const supabase = await createSupabaseServer();

  const { data: order } = await supabase
    .from("orders")
    .select("*, profiles!user_id(full_name, first_name, last_name, email, phone), order_items(*), shipments(carrier, destination_type, destination_address, destination_branch, tracking_number, tracking_provider, weight_grams)")
    .eq("id", id)
    .single();

  if (!order) notFound();

  const shipment = order.shipments?.[0] ?? null;
  const addr = order.shipping_address ?? {};
  const dest = shipment?.destination_address ?? null;
  const branch = shipment?.destination_branch ?? null;

  const profName =
    [order.profiles?.first_name, order.profiles?.last_name].filter(Boolean).join(" ") ||
    order.profiles?.full_name || addr.full_name || "—";

  const carrierKey =
    shipment?.carrier ??
    addr.carrier_selected ??
    "personalizado";
  const carrierLabel = CARRIER_LABEL[carrierKey] ?? carrierKey;

  const destinationType = shipment?.destination_type ?? order.destination_type_requested ?? "domicilio";
  const isPickup = destinationType === "sucursal";

  return (
    <div className="bg-white text-black mx-auto p-8 print:p-6" style={{ maxWidth: "210mm", fontFamily: "system-ui, -apple-system, sans-serif" }}>
      <PrintTrigger />

      {/* Encabezado */}
      <header className="border-b-2 border-black pb-3 mb-4 flex justify-between items-start">
        <div>
          <h1 className="text-2xl font-bold">🌸 Cancerianas</h1>
          <p className="text-sm text-gray-600">Orden de preparación de envío</p>
        </div>
        <div className="text-right">
          <p className="text-xl font-bold font-mono">{order.order_number}</p>
          <p className="text-xs text-gray-600">
            {new Date(order.created_at).toLocaleString("es-AR", {
              day: "2-digit", month: "2-digit", year: "numeric",
              hour: "2-digit", minute: "2-digit",
            })}
          </p>
          {order.source === "live" && (
            <p className="text-xs font-bold mt-1">🌸 LIVE</p>
          )}
        </div>
      </header>

      {/* Cliente + Envío en grid */}
      <section className="grid grid-cols-2 gap-4 mb-4 text-sm">
        <div className="border border-gray-300 rounded p-3">
          <h2 className="text-xs font-bold uppercase tracking-wider text-gray-600 mb-1">Cliente</h2>
          <p className="font-bold text-base">{profName}</p>
          {order.profiles?.email && <p>✉ {order.profiles.email}</p>}
          {(order.profiles?.phone || addr.phone) && <p>📱 {order.profiles?.phone || addr.phone}</p>}
          {dest?.documento && <p className="text-xs text-gray-700 mt-1">DNI: {dest.documento}</p>}
        </div>

        <div className="border border-gray-300 rounded p-3">
          <h2 className="text-xs font-bold uppercase tracking-wider text-gray-600 mb-1">Envío</h2>
          <p className="font-bold text-base">{carrierLabel}</p>
          <p className="text-xs">{isPickup ? "Retiro en sucursal" : "A domicilio"}</p>
          {shipment?.tracking_number && (
            <p className="text-xs mt-1">
              Tracking: <span className="font-mono font-bold">{shipment.tracking_number}</span>
              {shipment.tracking_provider && <> · {shipment.tracking_provider}</>}
            </p>
          )}
          {shipment?.weight_grams && (
            <p className="text-xs text-gray-700">Peso declarado: {shipment.weight_grams} g</p>
          )}
        </div>
      </section>

      {/* Dirección destino */}
      <section className="border-2 border-black rounded p-3 mb-4 text-sm">
        <h2 className="text-xs font-bold uppercase tracking-wider text-gray-600 mb-2">
          {isPickup ? "Sucursal de retiro" : "Dirección de entrega"}
        </h2>

        {isPickup && branch ? (
          <div>
            <p className="font-bold text-base">{branch.nombre || branch.name || "—"}</p>
            {(branch.direccion || branch.address) && (
              <p>{branch.direccion || branch.address}</p>
            )}
            <p className="text-xs text-gray-700 mt-1">
              {[branch.localidad, branch.region || branch.provincia, branch.codigoPostal && `CP ${branch.codigoPostal}`]
                .filter(Boolean).join(" · ")}
            </p>
            {branch.operator && <p className="text-xs text-gray-600 uppercase font-bold mt-1">{branch.operator}</p>}
          </div>
        ) : dest ? (
          <div>
            <p className="font-bold text-base">{dest.nombre_completo || profName}</p>
            <p>
              {[dest.calle, dest.numero].filter(Boolean).join(" ")}
              {dest.piso && `, Piso ${dest.piso}`}
              {dest.depto && ` Depto ${dest.depto}`}
            </p>
            {dest.entre_calles && <p className="text-xs">Entre: {dest.entre_calles}</p>}
            <p>
              {[dest.localidad, dest.region, dest.codigoPostal && `CP ${dest.codigoPostal}`]
                .filter(Boolean).join(" · ")}
            </p>
            {dest.referencia && <p className="text-xs italic mt-1">Ref: {dest.referencia}</p>}
            {dest.telefono && <p className="text-xs mt-1">📱 {dest.telefono}</p>}
          </div>
        ) : (
          <p className="italic text-gray-600">
            La clienta aún no completó el formulario de envío.
          </p>
        )}
      </section>

      {/* Productos */}
      <section className="mb-4">
        <h2 className="text-sm font-bold uppercase tracking-wider mb-2 border-b border-black pb-1">
          Productos a preparar
        </h2>
        <table className="w-full text-sm border-collapse">
          <thead>
            <tr className="border-b border-gray-400">
              <th className="text-left py-1 w-8">✓</th>
              <th className="text-left py-1 w-12">Cant.</th>
              <th className="text-left py-1">Producto</th>
              <th className="text-right py-1 w-24">P. unit.</th>
              <th className="text-right py-1 w-24">Subtotal</th>
            </tr>
          </thead>
          <tbody>
            {order.order_items?.map((it: any) => (
              <tr key={it.id} className="border-b border-gray-200">
                <td className="py-2 align-top">
                  <div className="w-4 h-4 border border-black inline-block" />
                </td>
                <td className="py-2 align-top font-bold text-base">×{it.quantity}</td>
                <td className="py-2 align-top">{it.description}</td>
                <td className="py-2 align-top text-right">{formatPrice(it.unit_price)}</td>
                <td className="py-2 align-top text-right font-semibold">{formatPrice(it.subtotal)}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </section>

      {/* Totales */}
      <section className="flex justify-end mb-4">
        <div className="w-64 text-sm space-y-1">
          <div className="flex justify-between">
            <span>Subtotal:</span>
            <span>{formatPrice(order.subtotal)}</span>
          </div>
          <div className="flex justify-between">
            <span>Envío:</span>
            <span>
              {order.shipping_cost > 0
                ? formatPrice(order.shipping_cost)
                : <span className="italic text-gray-600">se cotiza aparte</span>}
            </span>
          </div>
          <div className="flex justify-between border-t-2 border-black pt-1 mt-1 font-bold text-base">
            <span>TOTAL:</span>
            <span>{formatPrice(order.total)}</span>
          </div>
        </div>
      </section>

      {/* Notas */}
      <section className="mt-6 border-t border-gray-300 pt-3 text-xs text-gray-700">
        <p className="mb-2 font-bold">Notas / observaciones de preparación:</p>
        <div className="h-16 border border-gray-300 rounded" />
        <div className="mt-4 flex justify-between">
          <div>
            <p>Preparado por: ____________________________</p>
          </div>
          <div>
            <p>Fecha: ____ / ____ / ________</p>
          </div>
        </div>
      </section>

      <footer className="mt-6 pt-3 border-t border-gray-300 text-center text-[10px] text-gray-500">
        Cancerianas · Orden {order.order_number} · Generado {new Date().toLocaleString("es-AR")}
      </footer>
    </div>
  );
}
