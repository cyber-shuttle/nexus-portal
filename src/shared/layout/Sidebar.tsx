"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { useAbility } from "@/shared/casl/AbilityProvider";
import { cn } from "@/lib/utils";
import { portalNav } from "./navConfig";

export function Sidebar() {
  const pathname = usePathname();
  const ability = useAbility();

  const items = portalNav.filter((item) => {
    if (!item.ability) return true;
    return ability.can(item.ability.action, item.ability.subject);
  });

  return (
    <aside className="flex w-[230px] shrink-0 flex-col border-r border-border bg-sidebar text-sidebar-foreground">
      <div className="px-7 pb-6 pt-6">
        <Link
          href="/home"
          className="font-display text-2xl font-extrabold uppercase tracking-tight text-nexus-blue-700"
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
                "relative flex min-h-11 items-center gap-3 px-7 py-2.5 text-sm transition",
                active
                  ? "bg-sidebar-accent text-sidebar-accent-foreground"
                  : "text-muted-foreground hover:bg-sidebar-accent/70 hover:text-foreground",
              )}
            >
              <Icon className="h-5 w-5 stroke-[1.75]" />
              <span className="truncate">{item.label}</span>
              {active && (
                <span className="absolute left-0 top-2 h-7 w-1.5 rounded-r-full bg-nexus-blue-500" />
              )}
            </Link>
          );
        })}
      </nav>
    </aside>
  );
}
