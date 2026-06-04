import { TraceListContainer } from "@features/tracing/components/TraceListContainer";
import type { Metadata } from "next";

export const metadata: Metadata = {
  title: "Trace · Admin",
};

export default async function AdminTraceDetailPage({
  params,
}: {
  params: Promise<{ traceId: string }>;
}) {
  const { traceId } = await params;
  return <TraceListContainer initialTraceId={traceId} />;
}
