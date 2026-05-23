// TF1 stub. The full Allocations tab table lands in phase TF1.
import type { ComputeAllocation } from "../schemas";

export type ProjectAllocationsTableProps = {
  allocations: ComputeAllocation[];
  onRowClick?: (allocation: ComputeAllocation) => void;
};

export function ProjectAllocationsTable(_props: ProjectAllocationsTableProps) {
  return null;
}
