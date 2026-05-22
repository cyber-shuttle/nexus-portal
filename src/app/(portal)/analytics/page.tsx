import { auth } from "@/shared/auth/auth";
import { personaForAnalytics } from "@/shared/auth/personaForAnalytics";
import { Breadcrumbs } from "@/shared/ui/Breadcrumbs";
import type { Metadata } from "next";
import { redirect } from "next/navigation";
import { AnalyticsPersonaSwitch } from "./AnalyticsPersonaSwitch";

export const metadata: Metadata = {
  title: "Analytics · Nexus Portal",
};

export default async function AnalyticsPage() {
  const session = await auth();
  const userId = session?.user?.id ?? session?.user?.email ?? null;
  if (!userId) redirect("/sign-in");

  const persona = personaForAnalytics(session);

  return (
    <div className="space-y-6">
      <Breadcrumbs items={[{ label: "Analytics" }]} />
      <AnalyticsPersonaSwitch persona={persona} userId={userId} />
    </div>
  );
}
