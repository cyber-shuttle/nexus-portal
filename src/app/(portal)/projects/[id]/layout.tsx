import { Breadcrumbs } from "@/shared/ui/Breadcrumbs";
import type { ReactNode } from "react";

export default async function ProjectDetailLayout(props: {
  children: ReactNode;
  params: Promise<{ id: string }>;
}) {
  const { id } = await props.params;
  return (
    <div className="space-y-6">
      <Breadcrumbs items={[{ label: "Projects", href: "/projects" }, { label: id }]} />
      {props.children}
    </div>
  );
}
