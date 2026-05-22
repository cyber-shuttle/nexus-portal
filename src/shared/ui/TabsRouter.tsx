"use client";

import { cn } from "@/lib/utils";
import { Tabs as TabsPrimitive } from "@base-ui/react/tabs";
import { useRouter, useSearchParams } from "next/navigation";
import * as React from "react";

export type TabsRouterTab = {
  value: string;
  label: React.ReactNode;
  content: React.ReactNode;
};

export type TabsRouterProps = {
  tabs: TabsRouterTab[];
  defaultValue: string;
  searchParam?: string;
  className?: string;
};

export function TabsRouter({
  tabs,
  defaultValue,
  searchParam = "tab",
  className,
}: TabsRouterProps) {
  const router = useRouter();
  const searchParams = useSearchParams();
  const activeRaw = searchParams.get(searchParam);
  const active = tabs.some((t) => t.value === activeRaw) ? (activeRaw as string) : defaultValue;

  const handleChange = (value: string | number | null) => {
    if (typeof value !== "string") return;
    const params = new URLSearchParams(searchParams.toString());
    if (value === defaultValue) params.delete(searchParam);
    else params.set(searchParam, value);
    const next = params.toString();
    router.replace(next ? `?${next}` : "?", { scroll: false });
  };

  return (
    <TabsPrimitive.Root value={active} onValueChange={handleChange} className={cn(className)}>
      <TabsPrimitive.List className="flex gap-1 border-b border-border/80">
        {tabs.map((tab) => (
          <TabsPrimitive.Tab
            key={tab.value}
            value={tab.value}
            className={cn(
              "relative -mb-px inline-flex items-center justify-center rounded-t-md px-4 py-2 text-sm font-medium text-muted-foreground transition-colors",
              "hover:text-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring",
              "data-selected:border-b-2 data-selected:border-[color:var(--nexus-blue-500)] data-selected:text-foreground",
            )}
          >
            {tab.label}
          </TabsPrimitive.Tab>
        ))}
      </TabsPrimitive.List>
      {tabs.map((tab) => (
        <TabsPrimitive.Panel key={tab.value} value={tab.value} className="pt-6">
          {tab.content}
        </TabsPrimitive.Panel>
      ))}
    </TabsPrimitive.Root>
  );
}
