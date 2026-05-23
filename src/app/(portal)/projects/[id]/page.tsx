import { ProjectDetailContainer } from "./ProjectDetailContainer";

export default async function ProjectDetailPage(props: { params: Promise<{ id: string }> }) {
  const { id } = await props.params;
  return <ProjectDetailContainer projectId={id} />;
}
