"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { Trash2, CreditCard, Truck, Mail, Phone, Info, Banknote, Home, MapPin } from "lucide-react";
import { toast } from "sonner";
import { createSupabaseBrowser } from "@/lib/supabase-browser";
import { formatPrice, calcPackageFromCart, describePackage, isValidEmail, isValidPhoneAR } from "@cancerianas/shared";
import Header from "@/components/Header";
import Footer from "@/components/Footer";
import TransferInstructions from "@/components/TransferInstructions";
import PaymentProofUploader from "@/components/PaymentProofUploader";

export default function CheckoutClient() {
  const supabase = createSupabaseBrowser();
  const router = useRouter();
  const [user, setUser] = useState<any>(null);
  const [profile, setProfile] = useState<any>(null);
  const [items, setItems] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [submitting, setSubmitting] = useState(false);
  const [contact, setContact] = useState({ full_name: "", email: "", phone: "" });
  const [paymentMethods, setPaymentMethods] = useState<any>({});
  const [shippingExtras, setShippingExtras] = useState<any>({});
  const [brand, setBrand] = useState<{ whatsapp?: string }>({});
  const [selectedMethod, setSelectedMethod] = useState<"transfer" | "mercadopago" | null>(null);
  // Modalidad de entrega: domicilio o sucursal (el detalle se completa después en /shipment).
  const [destinationType, setDestinationType] = useState<"domicilio" | "sucursal">("domicilio");
  // Orden creada tras confirmar transferencia — guardamos id + datos para mostrar TransferInstructions + uploader.
  const [confirmedOrder, setConfirmedOrder] = useState<{
    id: string; order_number: string; total: number;
    alias: string; bank: string; cbu: string; holder: string;
  } | null>(null);

  useEffect(() => {
    (async () => {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) { router.replace("/auth?redirect=/checkout"); return; }
      setUser(user);

      const [{ data: prof }, { data: cart }, { data: settingsRows }] = await Promise.all([
        supabase.from("profiles").select("*").eq("id", user.id).single(),
        supabase.from("carts").select("id").eq("user_id", user.id).eq("status", "active").maybeSingle(),
        supabase.from("site_settings").select("key, value").in("key", ["payment_methods", "shipping_extras", "brand_info"]),
      ]);

      setProfile(prof);
      setContact({ full_name: prof?.full_name ?? "", email: user.email ?? "", phone: prof?.phone ?? "" });

      const settingsMap: Record<string, any> = {};
      (settingsRows ?? []).forEach((r: any) => { settingsMap[r.key] = r.value; });
      const pm = settingsMap.payment_methods ?? {};
      const ex = settingsMap.shipping_extras ?? {};
      const br = settingsMap.brand_info ?? {};
      setPaymentMethods(pm);
      setShippingExtras(ex);
      setBrand(br);
      // Preseleccionar el único método habilitado si hay uno solo
      const available = [pm.transfer_enabled && "transfer", pm.mercadopago_enabled && "mercadopago"].filter(Boolean) as ("transfer" | "mercadopago")[];
      if (available.length === 1) setSelectedMethod(available[0]);

      if (cart) {
        const { data: cartItems } = await supabase
          .from("cart_items")
          .select("*, products(name, images, slug, weight_grams, length_cm, width_cm, height_cm), product_variants(name)")
          .eq("cart_id", cart.id);
        setItems(cartItems ?? []);
      }
      setLoading(false);
    })();
  }, []);

  const subtotal = items.reduce((sum, it) => sum + Number(it.unit_price) * it.quantity, 0);

  const pkg = calcPackageFromCart(
    items.map((it) => ({
      quantity: it.quantity,
      weight_grams: it.products?.weight_grams,
      length_cm: it.products?.length_cm,
      width_cm: it.products?.width_cm,
      height_cm: it.products?.height_cm,
    }))
  );
  const pkgDescription = describePackage(items, pkg);

  async function removeItem(id: string) {
    await supabase.from("cart_items").delete().eq("id", id);
    setItems(items.filter((i) => i.id !== id));
  }

  async function createOrder(method: "transfer" | "mercadopago") {
    if (!contact.full_name.trim()) return toast.error("Falta el nombre");
    if (!contact.email.trim() || !isValidEmail(contact.email)) return toast.error("Email inválido");
    if (contact.phone && !isValidPhoneAR(contact.phone)) return toast.error("Número de WhatsApp inválido");
    if (items.length === 0) return toast.error("Tu carrito está vacío");
    setSubmitting(true);
    try {
      if (profile && (profile.full_name !== contact.full_name || profile.phone !== contact.phone)) {
        await supabase.from("profiles").update({ full_name: contact.full_name, phone: contact.phone }).eq("id", user.id);
      }

      const { data: order, error: orderError } = await supabase
        .from("orders")
        .insert({
          user_id: user.id,
          status: "pending",
          source: "catalog",
          subtotal,
          shipping_cost: 0,
          total: subtotal,
          payment_method: method,
          shipping_address: { full_name: contact.full_name, email: contact.email, phone: contact.phone },
          wants_shipping: true,
          destination_type_requested: destinationType,
        })
        .select()
        .single();
      if (orderError || !order) throw new Error(orderError?.message || "No se pudo crear la orden");

      const orderItems = items.map((it) => ({
        order_id: order.id,
        product_id: it.product_id,
        variant_id: it.variant_id,
        description: (it.products?.name ?? "Producto") + (it.product_variants ? ` (${it.product_variants.name})` : ""),
        image_url: it.products?.images?.[0],
        quantity: it.quantity,
        unit_price: it.unit_price,
        subtotal: it.unit_price * it.quantity,
      }));
      await supabase.from("order_items").insert(orderItems);

      // Marcar carrito como convertido
      await supabase.from("carts").update({ status: "converted" }).eq("user_id", user.id).eq("status", "active");

      if (method === "transfer") {
        setConfirmedOrder({
          id: order.id,
          order_number: order.order_number,
          total: Number(order.total),
          alias: paymentMethods.transfer_alias ?? "",
          bank: paymentMethods.transfer_bank ?? "",
          cbu: paymentMethods.transfer_cbu ?? "",
          holder: paymentMethods.transfer_holder ?? "",
        });
        // Llevar al usuario al tope para que vea la pantalla de confirmación
        // (sino queda parado donde estaba el botón de Confirmar).
        window.scrollTo({ top: 0, behavior: "smooth" });
      } else {
        // Mercado Pago
        const { data: { session } } = await supabase.auth.getSession();
        const res = await fetch(
          `${process.env.NEXT_PUBLIC_SUPABASE_URL}/functions/v1/create-payment-preference`,
          { method: "POST", headers: { Authorization: `Bearer ${session?.access_token}`, "Content-Type": "application/json" }, body: JSON.stringify({ type: "order", id: order.id }) }
        );
        const result = await res.json();
        if (!res.ok || !result.init_point) throw new Error(result.error || "No se pudo iniciar el pago");
        window.location.href = result.init_point;
      }
    } catch (e: any) {
      toast.error(e.message);
    } finally {
      setSubmitting(false);
    }
  }

  const availableMethods = [
    paymentMethods.transfer_enabled && "transfer",
    paymentMethods.mercadopago_enabled && "mercadopago",
  ].filter(Boolean) as ("transfer" | "mercadopago")[];

  if (loading) return (
    <><Header /><div className="max-w-6xl mx-auto px-4 py-20 text-center text-ink-soft">Cargando...</div><Footer /></>
  );

  // ─── PANTALLA DE CONFIRMACIÓN DE TRANSFERENCIA ───────────────────────────
  if (confirmedOrder) {
    return (
      <>
        <Header />
        <section className="max-w-2xl mx-auto px-4 py-10 space-y-4">
          <TransferInstructions
            orderNumber={confirmedOrder.order_number}
            total={confirmedOrder.total}
            alias={confirmedOrder.alias}
            cbu={confirmedOrder.cbu}
            bank={confirmedOrder.bank}
            holder={confirmedOrder.holder}
          />

          {user && (
            <PaymentProofUploader
              entityType="order"
              entityId={confirmedOrder.id}
              userId={user.id}
              reference={confirmedOrder.order_number}
              amount={confirmedOrder.total}
              whatsappNumber={brand.whatsapp}
              label="la orden"
              currentStatus="pending"
            />
          )}

          <a href={`/orders/${confirmedOrder.id}`} className="btn-secondary w-full flex items-center justify-center gap-2">
            Ver detalle de mi orden
          </a>
        </section>
        <Footer />
      </>
    );
  }

  return (
    <>
      <Header />
      <section className="max-w-6xl mx-auto px-4 py-10">
        <h1 className="font-display text-4xl text-ink-primary mb-2">Tu carrito</h1>
        <p className="text-ink-secondary mb-8">{pkgDescription}</p>

        {items.length === 0 ? (
          <div className="card text-center py-20">
            <div className="text-6xl mb-4">🛍️</div>
            <p className="text-ink-secondary mb-6">Tu carrito está vacío.</p>
            <button onClick={() => router.push("/")} className="btn-primary">Ir a la tienda</button>
          </div>
        ) : (
          <div className="grid lg:grid-cols-[1fr_400px] gap-8">
            <div className="space-y-6">
              {/* Items */}
              <div className="card space-y-4">
                <h2 className="font-display text-xl">Productos</h2>
                {items.map((it) => (
                  <div key={it.id} className="flex gap-4 pb-4 border-b border-rose-pastel last:border-0">
                    <div className="w-20 h-20 rounded-2xl bg-rose-pastel overflow-hidden flex-shrink-0">
                      {it.products?.images?.[0] && <img src={it.products.images[0]} alt="" className="w-full h-full object-cover" />}
                    </div>
                    <div className="flex-1 min-w-0">
                      <p className="font-semibold text-ink-primary line-clamp-1">{it.products?.name}</p>
                      {it.product_variants && <p className="text-sm text-ink-soft">{it.product_variants.name}</p>}
                      <p className="text-sm text-ink-secondary mt-1">x{it.quantity}</p>
                    </div>
                    <div className="text-right">
                      <p className="font-bold text-rose-deep">{formatPrice(it.unit_price * it.quantity)}</p>
                      <button onClick={() => removeItem(it.id)} className="text-ink-soft hover:text-error mt-1"><Trash2 className="w-4 h-4" /></button>
                    </div>
                  </div>
                ))}
              </div>

              {/* Datos de contacto */}
              <div className="card space-y-4">
                <h2 className="font-display text-xl">Tus datos</h2>
                <div className="space-y-3">
                  <input className="input" placeholder="Nombre completo" autoComplete="name" value={contact.full_name} onChange={(e) => setContact({ ...contact, full_name: e.target.value })} />
                  <div className="relative">
                    <Mail className="absolute left-4 top-1/2 -translate-y-1/2 w-4 h-4 text-ink-soft pointer-events-none" />
                    <input className="input pl-11" type="email" placeholder="Email" autoComplete="email" value={contact.email} onChange={(e) => setContact({ ...contact, email: e.target.value })} />
                  </div>
                  <div className="relative">
                    <Phone className="absolute left-4 top-1/2 -translate-y-1/2 w-4 h-4 text-ink-soft pointer-events-none" />
                    <input className="input pl-11" type="tel" placeholder="WhatsApp (opcional)" autoComplete="tel" value={contact.phone} onChange={(e) => setContact({ ...contact, phone: e.target.value })} />
                  </div>
                </div>
              </div>

              {/* Modalidad de entrega */}
              <div className="card space-y-3">
                <h2 className="font-display text-xl">¿Cómo querés recibirlo?</h2>
                <p className="text-xs text-ink-soft -mt-2">Después de confirmar el pago te pedimos la dirección o la sucursal exacta.</p>
                <div className="grid sm:grid-cols-2 gap-3">
                  <label className={`flex items-start gap-3 cursor-pointer rounded-2xl border-2 p-4 transition ${destinationType === "domicilio" ? "border-rose-deep bg-rose-whisper" : "border-rose-pastel hover:border-rose-medium/50"}`}>
                    <input type="radio" name="destination" className="mt-1 accent-rose-deep" checked={destinationType === "domicilio"} onChange={() => setDestinationType("domicilio")} />
                    <div>
                      <div className="flex items-center gap-2">
                        <Home className="w-5 h-5 text-rose-deep" />
                        <span className="font-semibold text-ink-primary">Envío a domicilio</span>
                      </div>
                      <p className="text-xs text-ink-soft mt-1">Te lo llevan hasta la puerta de tu casa.</p>
                    </div>
                  </label>
                  <label className={`flex items-start gap-3 cursor-pointer rounded-2xl border-2 p-4 transition ${destinationType === "sucursal" ? "border-rose-deep bg-rose-whisper" : "border-rose-pastel hover:border-rose-medium/50"}`}>
                    <input type="radio" name="destination" className="mt-1 accent-rose-deep" checked={destinationType === "sucursal"} onChange={() => setDestinationType("sucursal")} />
                    <div>
                      <div className="flex items-center gap-2">
                        <MapPin className="w-5 h-5 text-rose-deep" />
                        <span className="font-semibold text-ink-primary">Retiro en sucursal</span>
                      </div>
                      <p className="text-xs text-ink-soft mt-1">Lo retirás en una sucursal cercana de correo (suele salir más barato).</p>
                    </div>
                  </label>
                </div>
              </div>

              {/* Método de pago */}
              {availableMethods.length > 0 && (
                <div className="card space-y-4">
                  <h2 className="font-display text-xl">Cómo querés pagar</h2>
                  <div className="space-y-3">
                    {paymentMethods.transfer_enabled && (
                      <label className={`flex items-start gap-3 cursor-pointer rounded-2xl border-2 p-4 transition ${selectedMethod === "transfer" ? "border-rose-deep bg-rose-whisper" : "border-rose-pastel hover:border-rose-medium/50"}`}>
                        <input type="radio" name="payment" className="mt-1 accent-rose-deep" checked={selectedMethod === "transfer"} onChange={() => setSelectedMethod("transfer")} />
                        <div>
                          <div className="flex items-center gap-2">
                            <Banknote className="w-5 h-5 text-rose-deep" />
                            <span className="font-semibold text-ink-primary">Transferencia bancaria / Alias</span>
                          </div>
                          <p className="text-xs text-ink-soft mt-1">Transferís al alias que te indicamos y te confirmamos el pedido manualmente.</p>
                        </div>
                      </label>
                    )}
                    {paymentMethods.mercadopago_enabled && (
                      <label className={`flex items-start gap-3 cursor-pointer rounded-2xl border-2 p-4 transition ${selectedMethod === "mercadopago" ? "border-rose-deep bg-rose-whisper" : "border-rose-pastel hover:border-rose-medium/50"}`}>
                        <input type="radio" name="payment" className="mt-1 accent-rose-deep" checked={selectedMethod === "mercadopago"} onChange={() => setSelectedMethod("mercadopago")} />
                        <div>
                          <div className="flex items-center gap-2">
                            <CreditCard className="w-5 h-5 text-rose-deep" />
                            <span className="font-semibold text-ink-primary">Mercado Pago</span>
                          </div>
                          <p className="text-xs text-ink-soft mt-1">Tarjeta de crédito/débito, dinero en cuenta MP o cuotas.</p>
                        </div>
                      </label>
                    )}
                  </div>
                </div>
              )}

              {availableMethods.length === 0 && (
                <div className="card bg-warning/10 border border-warning/40 text-center py-6">
                  <p className="font-semibold text-ink-primary">La tienda no tiene métodos de pago habilitados.</p>
                  <p className="text-ink-soft text-sm mt-1">Contactanos por WhatsApp para coordinar tu compra.</p>
                </div>
              )}
            </div>

            {/* Resumen lateral */}
            <div className="card h-fit space-y-4 sticky top-24">
              <h2 className="font-display text-xl">Resumen</h2>

              <div className="rounded-2xl bg-rose-pastel/50 p-4 flex items-start gap-3">
                <Truck className="w-5 h-5 text-rose-deep flex-shrink-0 mt-0.5" />
                <div className="text-sm">
                  <strong className="text-ink-primary">Envío en dos pasos.</strong>
                  <ul className="mt-1 space-y-1 text-ink-secondary">
                    <li>1️⃣ Confirmás y pagás los productos.</li>
                    <li>2️⃣ Cuando confirmemos el pago, te mandamos el link para elegir el envío.</li>
                  </ul>
                </div>
              </div>

              {/* Mensaje motivador / confirmación de envío gratis */}
              {Number(shippingExtras.free_shipping_threshold) > 0 && (
                subtotal >= Number(shippingExtras.free_shipping_threshold) ? (
                  <div className="rounded-2xl bg-success/10 border border-success/40 p-3 text-sm text-success font-semibold flex items-center gap-2">
                    🎉 ¡Tu pedido tiene envío gratis incluido!
                  </div>
                ) : (
                  <div className="rounded-2xl bg-rose-whisper border border-rose-pastel p-3 text-sm text-ink-secondary">
                    Te faltan <strong className="text-rose-deep">{formatPrice(Number(shippingExtras.free_shipping_threshold) - subtotal)}</strong> para envío gratis 🌸
                  </div>
                )
              )}

              <div className="space-y-2 text-sm">
                <div className="flex justify-between">
                  <span className="text-ink-soft">Subtotal productos</span>
                  <span>{formatPrice(subtotal)}</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-ink-soft">Envío</span>
                  <span className="text-ink-soft italic">se cotiza aparte</span>
                </div>
              </div>
              <div className="border-t border-rose-pastel pt-3 flex justify-between items-baseline">
                <span className="font-display text-xl">Total</span>
                <span className="font-display text-2xl font-bold text-rose-deep">{formatPrice(subtotal)}</span>
              </div>

              <button
                onClick={() => selectedMethod && createOrder(selectedMethod)}
                disabled={submitting || !selectedMethod || availableMethods.length === 0}
                className="btn-primary w-full py-4 disabled:opacity-50"
              >
                {submitting
                  ? "Procesando..."
                  : selectedMethod === "transfer"
                  ? "Confirmar pedido por transferencia"
                  : "Pagar con Mercado Pago"}
              </button>

              <div className="text-xs text-ink-soft flex items-start gap-2 leading-relaxed">
                <Info className="w-3.5 h-3.5 flex-shrink-0 mt-0.5" />
                <span>
                  Al pagar reservás los productos. Tenés 7 días para completar el envío. Si no lo
                  hacés, te reembolsamos.
                </span>
              </div>
            </div>
          </div>
        )}
      </section>

      <Footer />
    </>
  );
}

