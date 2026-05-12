"use client";

import { useState, useMemo, useEffect } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import Link from "next/link";
import { ArrowLeft, Save, Search, Package, Sparkles, Truck, CheckCircle2 } from "lucide-react";
import { toast } from "sonner";
import { createSupabaseBrowser } from "@/lib/supabase-browser";
import {
  formatPrice,
  CARRIER_LABELS,
  type ShipmentCarrier,
  type PendingPackage,
} from "@cancerianas/shared";

type UserRow = {
  id: string;
  full_name: string | null;
  email: string;
  phone: string | null;
  role: string;
};

const PRESETS = [
  { label: "Sobre liviano", weight: 250, length: 25, width: 18, height: 2 },
  { label: "Caja chica", weight: 800, length: 25, width: 20, height: 10 },
  { label: "Caja mediana", weight: 1500, length: 35, width: 25, height: 15 },
  { label: "Caja grande", weight: 3000, length: 45, width: 35, height: 25 },
];

export default function NewShipmentForm({ users }: { users: UserRow[] }) {
  const supabase = createSupabaseBrowser();
  const router = useRouter();
  const searchParams = useSearchParams();
  const customerParam = searchParams.get("customer");

  const [userQuery, setUserQuery] = useState("");
  const [selectedUser, setSelectedUser] = useState<UserRow | null>(
    customerParam ? users.find((u) => u.id === customerParam) ?? null : null
  );
  const [pendingPackages, setPendingPackages] = useState<PendingPackage[]>([]);
  const [selectedPackageIds, setSelectedPackageIds] = useState<Set<string>>(new Set());
  const [loadingPackages, setLoadingPackages] = useState(false);

  const [carrier, setCarrier] = useState<ShipmentCarrier>("andreani");
  const [description, setDescription] = useState("");
  const [autoDescription, setAutoDescription] = useState(true);
  const [weight, setWeight] = useState(500);
  const [length, setLength] = useState(25);
  const [width, setWidth] = useState(20);
  const [height, setHeight] = useState(10);
  const [declaredValue, setDeclaredValue] = useState(0);
  const [internalNotes, setInternalNotes] = useState("");
  const [saving, setSaving] = useState(false);

  // Cargar paquetes pendientes de la clienta seleccionada
  useEffect(() => {
    if (!selectedUser) {
      setPendingPackages([]);
      setSelectedPackageIds(new Set());
      return;
    }
    setLoadingPackages(true);
    supabase
      .from("pending_packages")
      .select("*")
      .eq("user_id", selectedUser.id)
      .eq("status", "pending")
      .order("created_at", { ascending: false })
      .then(({ data, error }) => {
        if (!error && data) {
          setPendingPackages(data as PendingPackage[]);
          // Por defecto, marcar todos los paquetes
          setSelectedPackageIds(new Set(data.map((p: any) => p.id)));
        }
        setLoadingPackages(false);
      });
  }, [selectedUser?.id]);

  // Auto-completar descripción + declared_value en base a paquetes seleccionados
  useEffect(() => {
    if (!autoDescription || pendingPackages.length === 0) return;
    const selected = pendingPackages.filter((p) => selectedPackageIds.has(p.id));
    if (selected.length === 0) return;
    const desc = selected.map((p) => p.description).join(" + ");
    const val = selected.reduce((s, p) => s + Number(p.amount || 0), 0);
    setDescription(desc);
    if (declaredValue === 0 || autoDescription) setDeclaredValue(val);
  }, [selectedPackageIds, pendingPackages, autoDescription]);

  const filteredUsers = useMemo(() => {
    if (!userQuery) return users.slice(0, 20);
    const q = userQuery.toLowerCase();
    return users
      .filter((u) => ((u.full_name || "") + " " + u.email).toLowerCase().includes(q))
      .slice(0, 20);
  }, [users, userQuery]);

  function applyPreset(p: (typeof PRESETS)[number]) {
    setWeight(p.weight);
    setLength(p.length);
    setWidth(p.width);
    setHeight(p.height);
  }

  function togglePackage(id: string) {
    setSelectedPackageIds((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!selectedUser) return toast.error("Elegí una clienta");
    if (!description.trim()) return toast.error("Poné una descripción");
    if (weight <= 0) return toast.error("El peso debe ser > 0");

    const packageIds = Array.from(selectedPackageIds);
    setSaving(true);

    let shipmentId: string;

    if (packageIds.length > 0) {
      // FLUJO CONSOLIDACIÓN: usa el RPC para crear shipment + marcar packages como shipped atómicamente
      const { data, error } = await supabase.rpc("consolidate_pending_packages_into_shipment", {
        p_user_id: selectedUser.id,
        p_package_ids: packageIds,
        p_carrier: carrier,
        p_description: description.trim(),
        p_weight_grams: weight,
        p_length_cm: length,
        p_width_cm: width,
        p_height_cm: height,
        p_declared_value: declaredValue,
        p_internal_notes: internalNotes.trim() || null,
      });
      setSaving(false);
      if (error) {
        toast.error("Error: " + error.message);
        return;
      }
      shipmentId = data as string;
      toast.success(
        `Envío creado consolidando ${packageIds.length} paquete${packageIds.length === 1 ? "" : "s"} 🌸`
      );
    } else {
      // FLUJO LEGACY: shipment directo sin paquetes pendientes
      const { data, error } = await supabase
        .from("shipments")
        .insert({
          user_id: selectedUser.id,
          description: description.trim(),
          weight_grams: weight,
          length_cm: length,
          width_cm: width,
          height_cm: height,
          declared_value: declaredValue,
          internal_notes: internalNotes.trim() || null,
          carrier,
          status: "pending_address",
        })
        .select()
        .single();
      setSaving(false);
      if (error) {
        toast.error("Error: " + error.message);
        return;
      }
      shipmentId = data.id;
      toast.success(
        `Envío creado para ${selectedUser.full_name || selectedUser.email} 🌸`
      );
    }

    router.push(`/admin/shipments/${shipmentId}`);
    router.refresh();
  }

  const consolidationCount = selectedPackageIds.size;

  return (
    <form onSubmit={handleSubmit} className="space-y-5">
      <Link
        href="/admin/shipments"
        className="inline-flex items-center gap-2 text-ink-soft hover:text-rose-deep mb-2 text-sm"
      >
        <ArrowLeft className="w-4 h-4" /> Volver
      </Link>

      {/* SELECCIONAR CLIENTA */}
      <div className="card">
        <h2 className="font-display text-xl text-ink-primary mb-1">1 · ¿A quién?</h2>
        <p className="text-sm text-ink-soft mb-4">
          Elegí la clienta a la que le vas a mandar el paquete.
        </p>

        {selectedUser ? (
          <div className="bg-rose-whisper rounded-2xl p-4 flex items-center gap-3">
            <div className="w-12 h-12 rounded-full bg-rose-pastel flex items-center justify-center">
              🌸
            </div>
            <div className="flex-1">
              <div className="font-semibold text-ink-primary">
                {selectedUser.full_name || "Sin nombre"}
              </div>
              <div className="text-xs text-ink-soft">
                {selectedUser.email}
                {selectedUser.phone && ` · ${selectedUser.phone}`}
              </div>
            </div>
            <button
              type="button"
              onClick={() => setSelectedUser(null)}
              className="text-sm text-rose-deep hover:underline"
            >
              Cambiar
            </button>
          </div>
        ) : (
          <>
            <div className="relative mb-3">
              <Search className="w-4 h-4 absolute left-3 top-1/2 -translate-y-1/2 text-ink-soft" />
              <input
                type="text"
                placeholder="Buscar por nombre o email..."
                value={userQuery}
                onChange={(e) => setUserQuery(e.target.value)}
                className="input pl-10"
                autoFocus
              />
            </div>
            <div className="max-h-[300px] overflow-y-auto border border-rose-pastel rounded-2xl">
              {filteredUsers.length === 0 ? (
                <p className="text-center text-ink-soft py-6 text-sm">
                  No hay clientas con ese nombre
                </p>
              ) : (
                filteredUsers.map((u) => (
                  <button
                    type="button"
                    key={u.id}
                    onClick={() => setSelectedUser(u)}
                    className="w-full flex items-center gap-3 p-3 hover:bg-rose-whisper border-b border-rose-pastel/40 text-left"
                  >
                    <div className="w-10 h-10 rounded-full bg-rose-pastel flex items-center justify-center text-sm">
                      {(u.full_name || u.email)[0].toUpperCase()}
                    </div>
                    <div className="flex-1 min-w-0">
                      <div className="font-semibold text-ink-primary text-sm">
                        {u.full_name || "Sin nombre"}
                      </div>
                      <div className="text-xs text-ink-soft truncate">{u.email}</div>
                    </div>
                    {u.role === "admin" && (
                      <span className="text-[10px] bg-rose-deep text-white px-2 py-0.5 rounded-full font-bold">
                        admin
                      </span>
                    )}
                  </button>
                ))
              )}
            </div>
          </>
        )}
      </div>

      {/* PAQUETES PENDIENTES */}
      {selectedUser && (
        <div className="card">
          <h2 className="font-display text-xl text-ink-primary mb-1 flex items-center gap-2">
            <Package className="w-5 h-5 text-rose-deep" /> 2 · Paquetes pendientes a consolidar
          </h2>
          <p className="text-sm text-ink-soft mb-4">
            Tildá los paquetes que van en este envío. Los que dejes sin tildar quedan esperando para
            la próxima vez.
          </p>

          {loadingPackages ? (
            <p className="text-sm text-ink-soft">Cargando paquetes...</p>
          ) : pendingPackages.length === 0 ? (
            <div className="bg-rose-whisper/40 rounded-2xl p-4 text-sm text-ink-secondary">
              <Sparkles className="w-4 h-4 inline mr-1 text-rose-deep" />
              Esta clienta no tiene paquetes pendientes. Se va a crear un envío suelto sin
              consolidación. Si querés que aparezcan paquetes acá, marcá las dinámicas como{" "}
              <strong>"Atendida"</strong> en el panel del LIVE.
            </div>
          ) : (
            <>
              <div className="space-y-2">
                {pendingPackages.map((p) => {
                  const checked = selectedPackageIds.has(p.id);
                  return (
                    <label
                      key={p.id}
                      className={`flex items-start gap-3 p-3 rounded-2xl border-2 cursor-pointer transition ${
                        checked
                          ? "border-rose-deep bg-rose-whisper"
                          : "border-rose-pastel hover:border-rose-medium bg-white"
                      }`}
                    >
                      <input
                        type="checkbox"
                        checked={checked}
                        onChange={() => togglePackage(p.id)}
                        className="mt-1 w-5 h-5 accent-rose-deep flex-shrink-0"
                      />
                      <div className="flex-1 min-w-0">
                        <div className="font-semibold text-ink-primary line-clamp-1">
                          {p.description}
                        </div>
                        <div className="text-xs text-ink-soft mt-0.5">
                          {p.unit_count > 1 && `${p.unit_count} unidades · `}
                          {formatPrice(Number(p.amount))} ·{" "}
                          {new Date(p.created_at).toLocaleDateString("es-AR")}
                        </div>
                      </div>
                      {checked && <CheckCircle2 className="w-5 h-5 text-rose-deep flex-shrink-0" />}
                    </label>
                  );
                })}
              </div>

              <div className="mt-3 flex items-center justify-between text-sm">
                <span className="text-ink-secondary">
                  <strong>{consolidationCount}</strong> de {pendingPackages.length} seleccionados
                </span>
                <div className="flex gap-2">
                  <button
                    type="button"
                    onClick={() =>
                      setSelectedPackageIds(new Set(pendingPackages.map((p) => p.id)))
                    }
                    className="text-xs text-rose-deep hover:underline"
                  >
                    Todos
                  </button>
                  <button
                    type="button"
                    onClick={() => setSelectedPackageIds(new Set())}
                    className="text-xs text-ink-soft hover:underline"
                  >
                    Ninguno
                  </button>
                </div>
              </div>
            </>
          )}
        </div>
      )}

      {/* CARRIER (queda como sugerencia — la clienta confirma en su flujo) */}
      <div className="card">
        <h2 className="font-display text-xl text-ink-primary mb-1 flex items-center gap-2">
          <Truck className="w-5 h-5 text-rose-deep" /> 3 · Correo sugerido
        </h2>
        <p className="text-sm text-ink-soft mb-4">
          Sugerís un correo (la clienta puede cambiarlo desde el link cuando complete su dirección).
        </p>
        <div className="grid grid-cols-2 gap-3">
          {(["andreani", "correo_argentino"] as ShipmentCarrier[]).map((c) => {
            const sel = carrier === c;
            return (
              <button
                type="button"
                key={c}
                onClick={() => setCarrier(c)}
                className={`p-3 rounded-2xl border-2 text-left transition ${
                  sel
                    ? "border-rose-deep bg-rose-whisper"
                    : "border-rose-pastel hover:border-rose-medium"
                }`}
              >
                <div className="font-semibold text-ink-primary">{CARRIER_LABELS[c]}</div>
                <div className="text-xs text-ink-soft mt-0.5">
                  {c === "andreani"
                    ? "24-72hs · más rápido y caro"
                    : "3-7 días · más económico"}
                </div>
              </button>
            );
          })}
        </div>
      </div>

      {/* QUÉ MANDÁS */}
      <div className="card">
        <h2 className="font-display text-xl text-ink-primary mb-1">4 · ¿Qué mandás?</h2>
        <p className="text-sm text-ink-soft mb-4">
          Descripción del contenido. La ve la clienta y va en el rótulo.
        </p>

        <input
          type="text"
          placeholder='Ej: "Set Pétalos Lencería + cosmética"'
          value={description}
          onChange={(e) => {
            setDescription(e.target.value);
            setAutoDescription(false);
          }}
          className="input mb-3"
          required
        />
        <textarea
          placeholder="Notas internas (no las ve la clienta) — opcional"
          value={internalNotes}
          onChange={(e) => setInternalNotes(e.target.value)}
          className="input min-h-[60px] text-sm"
        />
      </div>

      {/* PESO Y MEDIDAS */}
      <div className="card">
        <h2 className="font-display text-xl text-ink-primary mb-1">5 · Peso y medidas</h2>
        <p className="text-sm text-ink-soft mb-3">
          Pesalo en una balanza, mide con regla. O usá un preset:
        </p>

        <div className="flex flex-wrap gap-2 mb-4">
          {PRESETS.map((p) => (
            <button
              type="button"
              key={p.label}
              onClick={() => applyPreset(p)}
              className="text-xs px-3 py-1.5 rounded-full bg-rose-whisper hover:bg-rose-pastel font-semibold"
            >
              {p.label}
            </button>
          ))}
        </div>

        <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
          <NumField label="Peso (gramos) *" value={weight} onChange={setWeight} required />
          <NumField label="Largo (cm)" value={length} onChange={setLength} />
          <NumField label="Ancho (cm)" value={width} onChange={setWidth} />
          <NumField label="Alto (cm)" value={height} onChange={setHeight} />
        </div>
      </div>

      {/* VALOR DECLARADO */}
      <div className="card">
        <h2 className="font-display text-xl text-ink-primary mb-1">6 · Valor declarado</h2>
        <p className="text-sm text-ink-soft mb-3">
          Cuánto vale el contenido. Lo usa el correo para calcular el seguro y eventuales reclamos.
        </p>
        <NumField label="$ Valor" value={declaredValue} onChange={setDeclaredValue} />
      </div>

      <div className="sticky bottom-4 flex justify-end">
        <button type="submit" disabled={saving || !selectedUser} className="btn-primary shadow-lift">
          <Save className="w-4 h-4" />
          {saving
            ? "Guardando..."
            : consolidationCount > 0
            ? `Consolidar ${consolidationCount} paquete${consolidationCount === 1 ? "" : "s"} y crear envío`
            : "Crear envío"}
        </button>
      </div>
    </form>
  );
}

function NumField({
  label,
  value,
  onChange,
  required,
}: {
  label: string;
  value: number;
  onChange: (v: number) => void;
  required?: boolean;
}) {
  return (
    <div>
      <label className="block text-xs font-semibold text-ink-secondary mb-1">{label}</label>
      <input
        type="number"
        value={value}
        min={0}
        onChange={(e) => onChange(Number(e.target.value) || 0)}
        className="input"
        required={required}
      />
    </div>
  );
}
