import ShipmentWizard from "@/components/ShipmentWizard";
import Header from "@/components/Header";
import Footer from "@/components/Footer";

export default async function ShipmentWizardPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  return (
    <>
      <Header />
      <ShipmentWizard shipmentId={id} />
      <Footer />
    </>
  );
}
