import { auth } from "@/shared/auth/auth";
import { PortalLayout } from "@/shared/layout/PortalLayout";
import { redirect } from "next/navigation";

export default async function PortalRoutesLayout({ children }: { children: React.ReactNode }) {
  const session = await auth();
  if (!session?.user) redirect("/sign-in");
  return <PortalLayout>{children}</PortalLayout>;
}
