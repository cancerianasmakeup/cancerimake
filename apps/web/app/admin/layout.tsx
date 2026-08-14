import Link from "next/link";
import { cookies } from "next/headers";
import { redirect } from "next/navigation";
import { LayoutDashboard, Package, ShoppingCart, Sparkles, Users, BarChart3, Settings, ArrowLeft, FolderHeart, Truck, PackagePlus, Store, AlertTriangle, FileText } from "lucide-react";
import { createSupabaseServer } from "@/lib/supabase-server";
import {
  STORE_COOKIE,
  getConfiguredStores,
  getDefaultStoreId,
  isStoreId,
  resolveStore,
  storeHomePath,
} from "@/lib/stores";
import AdminStoreChooser from "@/components/AdminStoreChooser";
import AdminStoreLogin from "@/components/AdminStoreLogin";
import AdminStoreSwitcher from "@/components/AdminStoreSwitcher";

const NAV = [
  { href: "/admin", label: "Dashboard", icon: LayoutDashboard },
  { href: "/admin/store", label: "Tienda", icon: Store },
  { href: "/admin/products", label: "Productos", icon: Package },
  { href: "/admin/low-stock", label: "Poco stock", icon: AlertTriangle },
  { href: "/admin/categories", label: "Categorías", icon: FolderHeart },
  { href: "/admin/remitos", label: "Remitos", icon: FileText },
  { href: "/admin/orders", label: "Órdenes", icon: ShoppingCart },
  { href: "/admin/shipments", label: "Envíos", icon: Truck },
  { href: "/admin/shipments/pending", label: "Paquetes pendientes", icon: PackagePlus },
  { href: "/admin/live", label: "LIVE", icon: Sparkles },
  { href: "/admin/customers", label: "Clientas", icon: Users },
  { href: "/admin/reports", label: "Reportes", icon: BarChart3 },
  { href: "/admin/settings", label: "Configuración", icon: Settings },
];

export default async function AdminLayout({ children }: { children: React.ReactNode }) {
  const stores = getConfiguredStores();
  const cookieStore = await cookies();
  const rawChoice = cookieStore.get(STORE_COOKIE)?.value;

  // Con más de una tienda configurada, lo primero es elegir en cuál trabajar.
  // Con una sola (mientras Mar del Plata no exista) se saltea y el panel entra
  // derecho, igual que siempre.
  if (stores.length > 1 && !isStoreId(rawChoice)) {
    return <AdminStoreChooser stores={stores} />;
  }

  const store = resolveStore(rawChoice);
  const supabase = await createSupabaseServer();
  const { data: { user } } = await supabase.auth.getUser();

  if (!user) {
    // Cada tienda es un proyecto Supabase con su propio padrón de usuarios. Para
    // la tienda de este deploy vale el login de siempre; para la otra hay que
    // autenticarse contra SU base, y eso tiene que pasar bajo /admin (que es
    // donde la cookie de tienda es visible). Mandarla a /auth la loguearía
    // contra la base equivocada.
    if (store.id === getDefaultStoreId()) redirect("/auth?redirect=/admin");
    return <AdminStoreLogin store={store} stores={stores} />;
  }

  const { data: profile } = await supabase
    .from("profiles")
    .select("role")
    .eq("id", user.id)
    .single();

  if (profile?.role !== "admin") {
    return (
      <div className="min-h-screen flex items-center justify-center px-4">
        <div className="card text-center max-w-md">
          <div className="text-5xl mb-3">🚫</div>
          <h1 className="font-display text-2xl text-ink-primary">No tenés acceso</h1>
          <p className="text-ink-secondary mt-2 mb-6">
            Tu usuario no es administrador en {store.shortName}.
          </p>
          {stores.length > 1 && (
            <div className="mb-4">
              <AdminStoreSwitcher current={store} stores={stores} />
            </div>
          )}
          <Link href={storeHomePath()} className="btn-primary">Volver a la tienda</Link>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen flex flex-col md:flex-row print:block">
      {/* Sidebar */}
      <aside className="md:w-64 border-r border-rose-pastel bg-white/70 backdrop-blur sticky top-0 md:h-screen z-30 print:hidden">
        <div className="p-4 border-b border-rose-pastel">
          <Link href="/admin" className="font-display text-xl text-rose-deep">🌸 Admin</Link>
          {stores.length > 1 ? (
            <div className="mt-2">
              <AdminStoreSwitcher current={store} stores={stores} />
            </div>
          ) : (
            <p className="text-xs text-ink-soft mt-1">{store.name}</p>
          )}
        </div>
        <nav className="p-2 flex md:flex-col overflow-x-auto">
          {NAV.map((item) => {
            const Icon = item.icon;
            return (
              <Link
                key={item.href}
                href={item.href}
                className="flex items-center gap-3 px-4 py-3 rounded-2xl text-ink-secondary hover:bg-rose-pastel hover:text-rose-deep transition whitespace-nowrap"
              >
                <Icon className="w-5 h-5 flex-shrink-0" />
                <span className="font-medium">{item.label}</span>
              </Link>
            );
          })}
        </nav>
        <div className="hidden md:block absolute bottom-4 left-2 right-2">
          <Link href={storeHomePath()} className="flex items-center gap-2 text-sm text-ink-soft hover:text-rose-deep px-4 py-2">
            <ArrowLeft className="w-4 h-4" /> Volver a la tienda
          </Link>
        </div>
      </aside>

      <main className="flex-1 min-w-0 p-4 md:p-8 print:p-0">{children}</main>
    </div>
  );
}
