"use client";

import { getLastTraceId, subscribeLastTraceId } from "@shared/api/last-trace-id";
import * as React from "react";

// Spec §11.4: surface the latest X-Trace-Id captured by apiFetch via a React
// context so toast deep-links and global "View this trace" affordances can
// read the value without coupling to the singleton.
const LastTraceContext = React.createContext<string | null | undefined>(undefined);

export function LastTraceProvider({ children }: { children: React.ReactNode }) {
  const [traceId, setTraceId] = React.useState<string | null>(() => getLastTraceId());

  React.useEffect(() => {
    // Re-read on mount in case apiFetch recorded a value between the lazy
    // initializer firing and this effect running.
    setTraceId(getLastTraceId());
    return subscribeLastTraceId(setTraceId);
  }, []);

  return <LastTraceContext.Provider value={traceId}>{children}</LastTraceContext.Provider>;
}

// Returns `undefined` when called outside the provider; queries.useLastTraceId
// falls back to the singleton in that case to preserve the public API.
export function useLastTraceContext(): string | null | undefined {
  return React.useContext(LastTraceContext);
}
