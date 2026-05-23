import type { Project } from "./schemas";

// Persona-aware project composition shared between the route container and its
// vitest helpers. Keeps the dedupe + badge logic out of React so the rules can
// be exercised without a hooks harness.

export type Persona = "researcher" | "pi" | "admin";

export type DedupedProject = {
  project: Project;
  // For PI persona: whether the row is one the user is PI on (vs member-only).
  // Researchers/admins always get `null` — the UI only renders the badge for
  // PIs where the distinction is load-bearing.
  membershipBadge: "pi" | "member" | null;
};

/**
 * Dedupe + tag projects from two source lists. Used by the PI persona path
 * which unions "projects where I am PI" with "projects I belong to as a
 * member"; the same row can appear in both, so we collapse by id and tag
 * the badge based on which list owned it.
 */
export function dedupePiAndMemberProjects(
  piRows: Project[],
  memberRows: Project[],
  myUserId: string,
): DedupedProject[] {
  const byId = new Map<string, DedupedProject>();
  for (const project of piRows) {
    byId.set(project.id, { project, membershipBadge: "pi" });
  }
  for (const project of memberRows) {
    if (byId.has(project.id)) continue;
    // Member-only union arm: a row may still be PI-owned by the same user if
    // the upstream lists are stale; trust `project_pi_id` as ground truth so
    // the badge stays consistent across reloads.
    const isOwnPi = project.project_pi_id === myUserId;
    byId.set(project.id, {
      project,
      membershipBadge: isOwnPi ? "pi" : "member",
    });
  }
  return Array.from(byId.values());
}

/** Researcher + admin paths render projects as-is, without the PI/member
 * distinction badge (researcher = always member; admin = sees all). */
export function tagAsPlain(rows: Project[]): DedupedProject[] {
  return rows.map((project) => ({ project, membershipBadge: null }));
}

/** Per-row rollup KPI from the project's allocations + their usage. */
export type ProjectRollup = {
  allocationsCount: number;
  totalSu: number;
  usedSu: number;
  usedPct: number;
};

export function computeProjectRollup(
  allocations: Array<{ initial_su_amount: number }>,
  usages: Array<{ used_su_amount: number } | undefined>,
): ProjectRollup {
  const totalSu = allocations.reduce((sum, a) => sum + (a.initial_su_amount ?? 0), 0);
  const usedSu = usages.reduce((sum, u) => sum + (u?.used_su_amount ?? 0), 0);
  // Floor at 1 so a project with allocations but 0 SUs allocated doesn't NaN
  // out the bar. UsageBar clamps anyway, but keep the math sane upstream.
  const safeMax = totalSu > 0 ? totalSu : 1;
  const usedPct = Math.min(500, (usedSu / safeMax) * 100);
  return {
    allocationsCount: allocations.length,
    totalSu,
    usedSu,
    usedPct,
  };
}

export type PersonaEmptyCopy = { heading: string; description: string };

export function emptyCopyFor(persona: Persona): PersonaEmptyCopy {
  if (persona === "researcher") {
    return {
      heading: "No projects yet",
      description: "Ask a PI to add you to one of their projects to get started.",
    };
  }
  if (persona === "pi") {
    return {
      heading: "No projects yet",
      description: "Create a project to start organizing your allocations.",
    };
  }
  return {
    heading: "No projects yet",
    description: "No projects in the catalog yet.",
  };
}
