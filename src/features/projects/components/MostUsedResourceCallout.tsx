// TF3 stub. The full callout (top-N stacked horizontal bar, drill click) is
// shared between allocation detail, project detail Resource Usage tab, and
// the analytics Resources tab — lands in phase TF3 to keep the visual once.
import type { ProjectUsageResourceRow } from "../schemas";

export type MostUsedResourceCalloutProps = {
  rows: ProjectUsageResourceRow[];
  onRowClick?: (row: ProjectUsageResourceRow) => void;
};

export function MostUsedResourceCallout(_props: MostUsedResourceCalloutProps) {
  return null;
}
