import { auth } from "@/shared/auth/auth";
import { redirect } from "next/navigation";
import { AllocationsListContainer } from "./AllocationsListContainer";

export default async function AllocationsListPage() {
  const session = await auth();
  const userId = session?.user?.id ?? session?.user?.email ?? null;
  if (!userId) redirect("/sign-in");
  return <AllocationsListContainer userId={userId} />;
}
