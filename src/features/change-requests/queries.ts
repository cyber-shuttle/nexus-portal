"use client";

import { useQuery } from "@tanstack/react-query";
import {
  getChangeRequestEvents,
  getChangeRequestsForAllocation,
  getChangeRequestsForUser,
} from "./api";

export const changeRequestKeys = {
  all: ["change-requests"] as const,
  forAllocation: (allocId: string) =>
    [...changeRequestKeys.all, "allocation", allocId] as const,
  forUser: (userId: string) => [...changeRequestKeys.all, "user", userId] as const,
  events: (reqId: string) => [...changeRequestKeys.all, "events", reqId] as const,
};

export function useChangeRequestsForAllocation(allocId: string | undefined) {
  return useQuery({
    queryKey: allocId
      ? changeRequestKeys.forAllocation(allocId)
      : ["change-requests", "allocation", "none"],
    queryFn: () => getChangeRequestsForAllocation(allocId as string),
    enabled: Boolean(allocId),
  });
}

export function useChangeRequestsForUser(userId: string | undefined) {
  return useQuery({
    queryKey: userId
      ? changeRequestKeys.forUser(userId)
      : ["change-requests", "user", "none"],
    queryFn: () => getChangeRequestsForUser(userId as string),
    enabled: Boolean(userId),
  });
}

export function useChangeRequestEvents(reqId: string | undefined) {
  return useQuery({
    queryKey: reqId ? changeRequestKeys.events(reqId) : ["change-requests", "events", "none"],
    queryFn: () => getChangeRequestEvents(reqId as string),
    enabled: Boolean(reqId),
  });
}
