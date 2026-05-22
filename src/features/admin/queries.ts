"use client";

import { useQuery } from "@tanstack/react-query";
import { type AdminChangeRequestsParams, getAdminChangeRequests, getAdminStats } from "./api";

export const adminKeys = {
  all: ["admin"] as const,
  stats: () => [...adminKeys.all, "stats"] as const,
  changeRequests: (params: AdminChangeRequestsParams = {}) =>
    [...adminKeys.all, "change-requests", params] as const,
};

export function useAdminStats() {
  return useQuery({
    queryKey: adminKeys.stats(),
    queryFn: getAdminStats,
  });
}

export function useAdminChangeRequests(params: AdminChangeRequestsParams = {}) {
  return useQuery({
    queryKey: adminKeys.changeRequests(params),
    queryFn: () => getAdminChangeRequests(params),
  });
}
