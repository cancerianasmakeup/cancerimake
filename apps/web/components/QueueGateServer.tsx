// Server wrapper de QueueGate. Carga los settings de la cola desde site_settings
// y los pasa al componente cliente. Si la cola está apagada o la página actual
// no está en el scope, renderiza null sin cargar JS extra.

import { getQueueSettings } from "@/lib/site-settings";
import QueueGate from "./QueueGate";

type ScopeKey = "shop" | "category" | "product" | "checkout";

export default async function QueueGateServer({ page }: { page: ScopeKey }) {
  const settings = await getQueueSettings();
  if (!settings.enabled) return null;
  if (settings.scope?.length && !settings.scope.includes(page)) return null;
  return <QueueGate settings={settings} />;
}
