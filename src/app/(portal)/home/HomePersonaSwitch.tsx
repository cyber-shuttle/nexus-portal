"use client";

import { AdminDashboard } from "@features/home/components/AdminDashboard";
import { PiDashboard } from "@features/home/components/PiDashboard";
import { ResearcherDashboard } from "@features/home/components/ResearcherDashboard";
import { useAdminHomeSummary } from "./useAdminHomeSummary";
import { useHomeSummary } from "./useHomeSummary";
import { usePiHomeSummary } from "./usePiHomeSummary";

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
