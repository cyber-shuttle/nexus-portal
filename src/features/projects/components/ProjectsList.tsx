// TF1 stub. The full presentational list (DataTable rows, Used % column,
// row-click navigation) lands in phase TF1 — keeping this file present so
// the route container can import a stable path during scaffolding.
import type { Project } from "../schemas";

export type ProjectsListProps = {
  projects: Project[];
  onRowClick?: (project: Project) => void;
};

export function ProjectsList(_props: ProjectsListProps) {
  return null;
}
