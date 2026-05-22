import { Breadcrumbs } from "@/shared/ui/Breadcrumbs";
import type { ReactNode } from "react";

export default async function AllocationDetailLayout(props: {
  children: ReactNode;
  params: Promise<{ id: string }>;
}) {
  const { id } = await props.params;
  return (
    <div className="space-y-6">
      <Breadcrumbs items={[{ label: "Allocations", href: "/allocations" }, { label: id }]} />
      {props.children}
    </div>
  );
}
