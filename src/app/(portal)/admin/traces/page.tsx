import { TraceListContainer } from "@features/tracing/components/TraceListContainer";
import type { Metadata } from "next";

export const metadata: Metadata = {
  title: "Tracing — Admin",
};

export default function AdminTracesPage() {
  return <TraceListContainer />;
}
