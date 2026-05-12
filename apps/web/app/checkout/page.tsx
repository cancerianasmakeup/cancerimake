import StoreGate from "@/components/StoreGate";
import CheckoutClient from "./CheckoutClient";

export const dynamic = "force-dynamic";

export default function CheckoutPage() {
  return (
    <StoreGate>
      <CheckoutClient />
    </StoreGate>
  );
}
