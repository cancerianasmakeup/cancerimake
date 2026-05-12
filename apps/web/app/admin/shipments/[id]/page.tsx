import ShipmentDetail from "@/components/ShipmentDetail";

export default async function AdminShipmentDetailPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  return <ShipmentDetail shipmentId={id} />;
}
