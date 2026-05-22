import { auth } from "@/shared/auth/auth";
import { Breadcrumbs } from "@/shared/ui/Breadcrumbs";
import type { Metadata } from "next";
import { redirect } from "next/navigation";
import { type HomePersona, HomePersonaSwitch } from "./HomePersonaSwitch";

export const metadata: Metadata = {
  title: "Home · Nexus Portal",
};

function personaFromRole(role: string | undefined): HomePersona {
  if (role === "admin") return "admin";
  if (role === "pi" || role === "co_pi" || role === "allocation_manager") return "pi";
  return "researcher";
}

export default async function HomePage() {
  const session = await auth();
  const userId = session?.user?.id ?? session?.user?.email ?? null;
  if (!userId) redirect("/sign-in");

  const firstName = session?.user?.name?.split(" ")[0] ?? "there";
  const persona = personaFromRole(session?.user?.role);

  return (
    <div className="space-y-6">
      <Breadcrumbs items={[{ label: "Home" }]} />
      <HomePersonaSwitch persona={persona} userId={userId} firstName={firstName} />
    </div>
  );
}
