import { AllocationDetailContainer } from "./AllocationDetailContainer";

export default async function AllocationDetailPage(props: { params: Promise<{ id: string }> }) {
  const { id } = await props.params;
  return <AllocationDetailContainer allocationId={id} />;
}
