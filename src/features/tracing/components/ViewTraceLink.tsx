"use client";

import { cn } from "@/lib/utils";
import { useAbility } from "@shared/casl/AbilityProvider";
import { ExternalLinkIcon } from "lucide-react";
import { usePathname, useRouter, useSearchParams } from "next/navigation";
import type * as React from "react";
import { shortHex } from "../utils";

export type ViewTraceLinkProps = {
  traceId: string | null | undefined;
  spanId?: string;
  variant?: "icon" | "text";
};

// Cross-feature: intentionally consumable by features/amie, features/audit,
// features/change-requests. This is the ONE place the no-cross-feature-imports
// rule is relaxed per spec §3.5 / Phase 5 carry-over from §6.
export function ViewTraceLink({ traceId, spanId, variant = "text" }: ViewTraceLinkProps) {
  const router = useRouter();
  const pathname = usePathname();
  const searchParams = useSearchParams();
  const ability = useAbility();

  if (!traceId || !ability.can("read", "Trace")) return null;

  // From any portal route, switch to /admin/traces/<id> so the drawer can
  // mount on the dedicated route — the spec's overlay-on-current-route
  // pattern would require a layout-level host that is too invasive for now.
  // From within /admin/traces, replace search params to keep the list mounted
  // — clone current params so existing filters (status/source/from/to/q) survive.
  const onAdminTraces = pathname.startsWith("/admin/traces");
  const params = onAdminTraces
    ? new URLSearchParams(searchParams?.toString() ?? "")
    : new URLSearchParams();
  params.set("trace", traceId);
  if (spanId) params.set("span", spanId);
  const target = onAdminTraces
    ? `${pathname}?${params.toString()}`
    : `/admin/traces/${encodeURIComponent(traceId)}${spanId ? `?span=${encodeURIComponent(spanId)}` : ""}`;

  const handleClick = (e: React.MouseEvent) => {
    e.preventDefault();
    if (onAdminTraces) router.replace(target, { scroll: false });
    else router.push(target);
  };

  if (variant === "icon") {
    return (
      <a
        href={target}
        onClick={handleClick}
        aria-label={`View trace ${shortHex(traceId, 8)}`}
        className={cn(
          "inline-flex size-6 items-center justify-center rounded-md text-muted-foreground",
          "hover:bg-muted hover:text-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring",
        )}
      >
        <ExternalLinkIcon className="size-3.5" aria-hidden="true" />
      </a>
    );
  }

  return (
    <a
      href={target}
      onClick={handleClick}
      className="text-xs text-muted-foreground hover:text-foreground underline-offset-2 hover:underline"
    >
      View trace →
    </a>
  );
}
