"use client";

import { cn } from "@/lib/utils";
import { Badge } from "@/shared/ui/badge";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/shared/ui/card";
import {
  ActivityIcon,
  ArrowRightIcon,
  BarChart3Icon,
  CpuIcon,
  ExternalLinkIcon,
  RocketIcon,
  TerminalIcon,
} from "lucide-react";
import Link from "next/link";

type ToolCard = {
  id: string;
  title: string;
  description: string;
  href: string;
  icon: React.ComponentType<{ className?: string }>;
  external?: boolean;
  status: "active" | "phase7";
};

const TOOLS: ToolCard[] = [
  {
    id: "system-status",
    title: "System status",
    description: "Health of compute clusters, queues, and the AMIE pipeline.",
    href: "/tools/system-status",
    icon: ActivityIcon,
    status: "phase7",
  },
  {
    id: "credit-transfer",
    title: "Credit transfer",
    description: "Move SUs between two of your allocations atomically.",
    href: "/tools/credit-transfer",
    icon: ArrowRightIcon,
    status: "active",
  },
  {
    id: "usage-report",
    title: "Usage report",
    description: "Export consumption per project, allocation, and user.",
    href: "/tools/usage-report",
    icon: BarChart3Icon,
    status: "phase7",
  },
  {
    id: "runtime-status",
    title: "Runtime status",
    description: "Live job feed and node-level utilization heatmap.",
    href: "/tools/runtime-status",
    icon: CpuIcon,
    status: "phase7",
  },
  {
    id: "terminal-access",
    title: "Terminal access",
    description: "SSH into Nexus directly via your browser session.",
    href: "https://terminal.nexus.local",
    icon: TerminalIcon,
    external: true,
    status: "active",
  },
  {
    id: "cybershuttle",
    title: "CyberShuttle",
    description: "Submit jobs from notebooks via the Apache Airavata CyberShuttle bridge.",
    href: "https://cybershuttle.org",
    icon: RocketIcon,
    external: true,
    status: "active",
  },
];

export function ToolsLanding() {
  return (
    <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-3">
      {TOOLS.map((tool) => {
        const Icon = tool.icon;
        const disabled = tool.status === "phase7";
        const wrapperClass = cn(
          "group h-full transition-colors",
          disabled ? "opacity-70" : "hover:bg-muted/40 cursor-pointer",
        );

        const inner = (
          <Card className={wrapperClass}>
            <CardHeader>
              <div className="flex items-start justify-between gap-3">
                <div className="space-y-1">
                  <CardTitle className="flex items-center gap-2">
                    <Icon className="h-4 w-4" aria-hidden />
                    {tool.title}
                  </CardTitle>
                  <CardDescription>{tool.description}</CardDescription>
                </div>
                {disabled ? (
                  <Badge variant="secondary" className="text-[0.65rem] uppercase">
                    Phase 7
                  </Badge>
                ) : tool.external ? (
                  <ExternalLinkIcon
                    className="h-4 w-4 text-muted-foreground"
                    aria-label="External link"
                  />
                ) : null}
              </div>
            </CardHeader>
            <CardContent className="pt-0">
              <p className="text-xs text-muted-foreground">
                {disabled
                  ? "Available after Phase 7 ships."
                  : tool.external
                    ? "Opens in a new tab."
                    : "Open tool"}
              </p>
            </CardContent>
          </Card>
        );

        if (disabled) {
          return (
            <div key={tool.id} aria-disabled title="Available after Phase 7 ships">
              {inner}
            </div>
          );
        }
        if (tool.external) {
          return (
            <a
              key={tool.id}
              href={tool.href}
              target="_blank"
              rel="noreferrer"
              className="block focus:outline-none focus-visible:ring-3 focus-visible:ring-ring/50 rounded-xl"
            >
              {inner}
            </a>
          );
        }
        return (
          <Link
            key={tool.id}
            href={tool.href}
            className="block focus:outline-none focus-visible:ring-3 focus-visible:ring-ring/50 rounded-xl"
          >
            {inner}
          </Link>
        );
      })}
    </div>
  );
}
