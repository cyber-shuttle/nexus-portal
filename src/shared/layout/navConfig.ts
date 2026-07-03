import type { LucideIcon } from "lucide-react";
import {
  Activity,
  BadgeCheck,
  ClipboardList,
  Coins,
  DollarSign,
  FileText,
  FolderKanban,
  GitPullRequest,
  LayoutDashboard,
  LineChart,
  ListChecks,
  Server,
  ShieldCheck,
  UserCog,
  Users,
  Wrench,
} from "lucide-react";

export type AbilityCheck = { action: string; subject: string };

export type NavGroup = "allocations" | "admin";

export type NavItem = {
  href: string;
  label: string;
  icon: LucideIcon;
  group: NavGroup;
  ability?: AbilityCheck;
};

export const NAV_GROUP_LABELS: Record<NavGroup, string> = {
  allocations: "My allocations",
  admin: "Site administration",
};

export const portalNav: NavItem[] = [
  { href: "/home", label: "Overview", icon: LayoutDashboard, group: "allocations" },
  // Per spec §5.1 slot 2 between Overview and Allocations. CASL gate uses the
  // researcher subject so every authed persona sees the link (admin via
  // `manage all`, PI also has `read AnalyticsResearcher` for self).
  {
    href: "/analytics",
    label: "Analytics",
    icon: LineChart,
    group: "allocations",
    ability: { action: "read", subject: "AnalyticsResearcher" },
  },
  // Slot 3 per team-feedback spec §5.1 — between Analytics and Allocations.
  // Every persona has `read Project` (CASL filters by membership) so the link
  // shows for everyone signed in; admin sees the unscoped list, PI sees PI+
  // member projects, researcher sees member-only.
  {
    href: "/projects",
    label: "Projects",
    icon: FolderKanban,
    group: "allocations",
    ability: { action: "read", subject: "Project" },
  },
  { href: "/allocations", label: "Allocations", icon: Server, group: "allocations" },
  {
    href: "/change-requests",
    label: "Change Requests",
    icon: GitPullRequest,
    group: "allocations",
  },
  { href: "/proposals", label: "Proposals", icon: FileText, group: "allocations" },
  { href: "/tools", label: "Tools", icon: Wrench, group: "allocations" },
  {
    href: "/signer/certificates",
    label: "SSH Certificates",
    icon: BadgeCheck,
    group: "allocations",
  },
  { href: "/clients", label: "Clients", icon: Users, group: "allocations" },
  {
    href: "/admin/users",
    label: "User Management",
    icon: UserCog,
    group: "admin",
    ability: { action: "manage", subject: "User" },
  },
  {
    href: "/admin/amie/packets",
    label: "AMIE Console",
    icon: ClipboardList,
    group: "admin",
    ability: { action: "manage", subject: "AmiePacket" },
  },
  {
    href: "/admin/traces",
    label: "Tracing",
    icon: Activity,
    group: "admin",
    ability: { action: "read", subject: "Trace" },
  },
  {
    href: "/admin/resources",
    label: "Resources",
    icon: ShieldCheck,
    group: "admin",
    ability: { action: "manage", subject: "Resource" },
  },
  {
    href: "/admin/rates",
    label: "Rates",
    icon: DollarSign,
    group: "admin",
    ability: { action: "manage", subject: "Rate" },
  },
  {
    href: "/admin/unmapped-jobs",
    label: "Unmapped Jobs",
    icon: ListChecks,
    group: "admin",
    ability: { action: "manage", subject: "UnmappedJob" },
  },
  {
    href: "/admin/adjustments",
    label: "Adjustments",
    icon: Coins,
    group: "admin",
    ability: { action: "manage", subject: "Adjustment" },
  },
];
