"use client";

import { cn } from "@/lib/utils";
import { useAbility } from "@/shared/casl/AbilityProvider";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { NeedHelpCard } from "./NeedHelpCard";
import { portalNav } from "./navConfig";

export function Sidebar() {
  const pathname = usePathname();
  const ability = useAbility();

  const items = portalNav.filter((item) => {
    if (!item.ability) return true;
    return ability.can(item.ability.action, item.ability.subject);
  });

  return (
    <aside className="flex w-[240px] shrink-0 flex-col border-r border-border bg-sidebar text-sidebar-foreground">
      <div className="px-6 pt-8 pb-6">
        <Link
          href="/home"
          className="font-display text-2xl font-extrabold uppercase tracking-tight text-brand"
        >
          Nexus
        </Link>
      </div>

      <nav className="flex flex-col">
        {items.map((item) => {
          const active = pathname === item.href || pathname.startsWith(`${item.href}/`);
          const Icon = item.icon;
          return (
            <Link
              key={item.href}
              href={item.href}
              aria-current={active ? "page" : undefined}
              className={cn(
                "relative flex h-11 items-center gap-3 px-6 text-sm font-medium transition",
                active
                  ? "bg-brand-tint font-semibold text-brand"
                  : "text-muted-foreground hover:bg-muted/40 hover:text-foreground",
              )}
            >
              <Icon className="h-5 w-5 stroke-[1.75]" />
              <span className="truncate">{item.label}</span>
              {/* Right-edge accent bar per Figma — opposite the collaborator's left-edge cue. */}
              {active && (
                <span className="absolute top-2 right-0 bottom-2 w-1 rounded-l-full bg-brand" />
              )}
            </Link>
          );
        })}
      </nav>

      <NeedHelpCard />
    </aside>
  );
}
