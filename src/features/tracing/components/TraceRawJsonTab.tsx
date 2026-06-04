"use client";

import { Button } from "@/shared/ui/button";
import { CopyIcon } from "lucide-react";
import dynamic from "next/dynamic";
import * as React from "react";
import type { Span, Trace } from "../types";

// Reuse Phase 3's lazy-loaded viewer — same theme + collapsed depth — so the
// raw tab doesn't double-bundle react-json-view-lite.
const PayloadJsonView = dynamic(() => import("./PayloadJsonView"), {
  ssr: false,
  loading: () => <div className="h-32 rounded-md border bg-muted/20" />,
});

export type TraceRawJsonTabProps = {
  trace: Trace;
  spans: Span[];
};

export function TraceRawJsonTab({ trace, spans }: TraceRawJsonTabProps) {
  const payload = React.useMemo(() => ({ trace, spans }), [trace, spans]);

  const onCopy = React.useCallback(async () => {
    const { toast } = await import("sonner");
    try {
      await navigator.clipboard.writeText(JSON.stringify(payload, null, 2));
      toast.success("Copied trace JSON");
    } catch {
      toast.error("Could not copy to clipboard");
    }
  }, [payload]);

  return (
    <div className="space-y-3">
      <div className="flex items-center justify-between">
        <h3 className="text-sm font-semibold">Raw JSON</h3>
        <Button variant="outline" size="sm" onClick={() => void onCopy()}>
          <CopyIcon className="size-3.5" aria-hidden="true" />
          Copy JSON
        </Button>
      </div>
      <PayloadJsonView data={payload} />
    </div>
  );
}
