import type { Metadata } from "next";
import { TraceListPage } from "@features/tracing/components/TraceListPage";

export const metadata: Metadata = {
  title: "Tracing — Admin",
};

export default function AdminTracesPage() {
  return <TraceListPage />;
}
