"use client";

import { cn } from "@/lib/utils";
import { useAbility } from "@/shared/casl/AbilityProvider";
import Link from "next/link";
import { usePathname } from "next/navigation";
import * as React from "react";
import { NAV_GROUP_LABELS, type NavGroup, type NavItem, portalNav } from "./navConfig";

const GROUP_ORDER: NavGroup[] = ["allocations", "admin"];

export function Sidebar() {
  const pathname = usePathname();
  const ability = useAbility();
  const navRef = React.useRef<HTMLElement>(null);

  React.useEffect(() => {
    const el = navRef.current;
    if (!el) return;
    let timer: ReturnType<typeof setTimeout>;
    function onScroll() {
      el!.classList.add("is-scrolling");
      clearTimeout(timer);
      timer = setTimeout(() => el!.classList.remove("is-scrolling"), 800);
    }
    el.addEventListener("scroll", onScroll, { passive: true });
    return () => { el.removeEventListener("scroll", onScroll); clearTimeout(timer); };
  }, []);

  const visible = portalNav.filter((item) => {
    if (!item.ability) return true;
    return ability.can(item.ability.action, item.ability.subject);
  });

  const groups = GROUP_ORDER.map((group) => ({
    group,
    items: visible.filter((item) => item.group === group),
  })).filter((g) => g.items.length > 0);

  return (
    <aside className="flex w-[240px] shrink-0 flex-col overflow-hidden border-r border-border bg-sidebar text-sidebar-foreground">
      <div className="px-6 pt-8 pb-6">
        <Link
          href="/home"
          className="font-display text-2xl font-extrabold uppercase tracking-tight text-brand"
        >
          Nexus
        </Link>
      </div>

      <nav ref={navRef} className="sidebar-scroll flex min-h-0 flex-1 flex-col">
        {groups.map(({ group, items }, idx) => (
          <div key={group} className={cn("flex flex-col", idx > 0 && "mt-4")}>
            <div className="px-6 pt-2 pb-1 text-[11px] font-semibold uppercase tracking-wider text-muted-foreground">
              {NAV_GROUP_LABELS[group]}
            </div>
            {items.map((item) => (
              <SidebarLink key={item.href} item={item} active={isActive(pathname, item.href)} />
            ))}
          </div>
        ))}
      </nav>


    </aside>
  );
}

function isActive(pathname: string, href: string): boolean {
  return pathname === href || pathname.startsWith(`${href}/`);
}

function SidebarLink({ item, active }: { item: NavItem; active: boolean }) {
  const Icon = item.icon;
  return (
    <Link
      href={item.href}
      aria-current={active ? "page" : undefined}
      className={cn(
        "relative flex h-11 items-center gap-3 px-6 text-sm font-medium transition",
        active
          ? "bg-[var(--sidebar-active)] font-semibold text-brand"
          : "text-muted-foreground hover:bg-[var(--sidebar-hover)] hover:text-foreground",
      )}
    >
      <Icon className="h-5 w-5 stroke-[1.75]" />
      <span className="truncate">{item.label}</span>
      {/* Right-edge accent bar per Figma — opposite the collaborator's left-edge cue. */}
      {active && <span className="absolute top-2 right-0 bottom-2 w-1 rounded-l-full bg-brand" />}
    </Link>
  );
}
