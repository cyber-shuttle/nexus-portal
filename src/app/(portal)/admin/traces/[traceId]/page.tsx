import type { Metadata } from "next";
import { TraceListPage } from "@features/tracing/components/TraceListPage";

export const metadata: Metadata = {
  title: "Trace · Admin",
};

export default async function AdminTraceDetailPage({
  params,
}: {
  params: Promise<{ traceId: string }>;
}) {
  const { traceId } = await params;
  return <TraceListPage initialTraceId={traceId} />;
}
