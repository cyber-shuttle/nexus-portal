"use client";

import { ErrorState } from "@/shared/ui/ErrorState";
import Link from "next/link";
import * as React from "react";

export default function GlobalError({
  error,
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  React.useEffect(() => {
    // Surface in dev; production aggregator wires here.
    console.error("portal global error", error);
  }, [error]);

  return (
    <main
      role="main"
      className="mx-auto flex min-h-[60vh] max-w-2xl flex-col items-center justify-center gap-4 px-6 py-12"
    >
      <ErrorState
        heading="Something broke"
        message={
          <span>
            {error.message || "An unexpected error stopped this page from rendering."}
            {error.digest ? (
              <span className="ml-2 font-mono text-xs">[{error.digest}]</span>
            ) : null}
          </span>
        }
        onRetry={reset}
        retryLabel="Try again"
      />
      <Link
        href="/home"
        className="text-sm text-muted-foreground underline-offset-4 hover:underline"
      >
        Back to overview
      </Link>
    </main>
  );
}
