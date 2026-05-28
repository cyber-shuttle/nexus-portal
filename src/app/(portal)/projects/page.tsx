import { auth } from "@/shared/auth/auth";
import { redirect } from "next/navigation";
import { ProjectsListContainer } from "./ProjectsListContainer";

// Map session role to the three persona modes the /projects scope uses. PI +
// co-PI + allocation_manager are all "pi-like" in that they have PI-owned
// rows alongside member-only rows; system admins see everything; everyone
// else is member-only. The admin axis is independent of the allocation role.
type Persona = "researcher" | "pi" | "admin";
function personaFor(role: string | undefined, systemRole: string | null | undefined): Persona {
  if (systemRole === "admin") return "admin";
  if (role === "pi" || role === "co_pi" || role === "allocation_manager") return "pi";
  return "researcher";
}

export default async function ProjectsListPage() {
  const session = await auth();
  const userId = session?.user?.id ?? session?.user?.email ?? null;
  if (!userId) redirect("/sign-in");
  const persona = personaFor(session?.user?.role, session?.systemRole);
  return <ProjectsListContainer userId={userId} persona={persona} />;
}
