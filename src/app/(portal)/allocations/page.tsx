import { redirect } from "next/navigation";
import { auth } from "@/shared/auth/auth";
import { AllocationsList } from "@features/allocations/components/AllocationsList";

export default async function AllocationsListPage() {
  const session = await auth();
  const userId = session?.user?.id ?? session?.user?.email ?? null;
  if (!userId) redirect("/sign-in");
  return <AllocationsList userId={userId} />;
}
