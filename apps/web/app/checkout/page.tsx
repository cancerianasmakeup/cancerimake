import StoreGate from "@/components/StoreGate";
import QueueGateServer from "@/components/QueueGateServer";
import CheckoutClient from "./CheckoutClient";

export const dynamic = "force-dynamic";

export default function CheckoutPage() {
  return (
    <StoreGate>
      <QueueGateServer page="checkout" />
      <CheckoutClient />
    </StoreGate>
  );
}
