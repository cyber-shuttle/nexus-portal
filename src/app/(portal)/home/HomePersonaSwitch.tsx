"use client";

import { PiDashboard } from "@features/home/components/PiDashboard";
import { ResearcherDashboard } from "@features/home/components/ResearcherDashboard";
import { CenteredSpinner } from "@/shared/ui/Loading";
import dynamic from "next/dynamic";
import { useAdminHomeSummary } from "./useAdminHomeSummary";
import { useHomeSummary } from "./useHomeSummary";
import { usePiHomeSummary } from "./usePiHomeSummary";

// AdminDashboard pulls Recharts; researchers and PIs never hit it. Lazy so the
// non-admin first paint isn't penalized for code only admins render.
const AdminDashboard = dynamic(
  () => import("@features/home/components/AdminDashboard").then((m) => m.AdminDashboard),
  { ssr: false, loading: () => <CenteredSpinner label="Loading admin dashboard" /> },
);

export type HomePersona = "researcher" | "pi" | "admin";

export type HomePersonaSwitchProps = {
  persona: HomePersona;
  userId: string;
  firstName: string;
};

export function HomePersonaSwitch({ persona, userId, firstName }: HomePersonaSwitchProps) {
  if (persona === "pi") {
    return <PiPanel userId={userId} firstName={firstName} />;
  }
  if (persona === "admin") {
    return <AdminPanel firstName={firstName} />;
  }
  return <ResearcherPanel userId={userId} firstName={firstName} />;
}

function ResearcherPanel({ userId, firstName }: { userId: string; firstName: string }) {
  const { data, usedByAllocation, isLoading, error } = useHomeSummary(userId);
  return (
    <ResearcherDashboard
      firstName={firstName}
      summary={data}
      isLoading={isLoading}
      error={error}
      usedByAllocation={usedByAllocation}
    />
  );
}

function PiPanel({ userId, firstName }: { userId: string; firstName: string }) {
  const { data, isLoading, error } = usePiHomeSummary(userId);
  return <PiDashboard firstName={firstName} summary={data} isLoading={isLoading} error={error} />;
}

function AdminPanel({ firstName }: { firstName: string }) {
  const { data, isLoading, error } = useAdminHomeSummary();
  return (
    <AdminDashboard firstName={firstName} summary={data} isLoading={isLoading} error={error} />
  );
}
