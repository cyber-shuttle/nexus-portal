import type { LucideIcon } from "lucide-react";
import {
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
  Settings,
  ShieldCheck,
  Users,
  Wrench,
} from "lucide-react";

export type AbilityCheck = { action: string; subject: string };

export type NavItem = {
  href: string;
  label: string;
  icon: LucideIcon;
  ability?: AbilityCheck;
};

export const portalNav: NavItem[] = [
  { href: "/home", label: "Overview", icon: LayoutDashboard },
  // Per spec §5.1 slot 2 between Overview and Allocations. CASL gate uses the
  // researcher subject so every authed persona sees the link (admin via
  // `manage all`, PI also has `read AnalyticsResearcher` for self).
  {
    href: "/analytics",
    label: "Analytics",
    icon: LineChart,
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
    ability: { action: "read", subject: "Project" },
  },
  { href: "/allocations", label: "Allocations", icon: Server },
  { href: "/change-requests", label: "Change Requests", icon: GitPullRequest },
  { href: "/proposals", label: "Proposals", icon: FileText },
  { href: "/tools", label: "Tools", icon: Wrench },
  { href: "/signer/certificates", label: "SSH Certificates", icon: BadgeCheck },
  { href: "/clients", label: "Clients", icon: Users },
  {
    href: "/admin/amie/packets",
    label: "AMIE Console",
    icon: ClipboardList,
    ability: { action: "manage", subject: "AmiePacket" },
  },
  {
    href: "/admin/resources",
    label: "Resources",
    icon: ShieldCheck,
    ability: { action: "manage", subject: "Resource" },
  },
  {
    href: "/admin/rates",
    label: "Rates",
    icon: DollarSign,
    ability: { action: "manage", subject: "Rate" },
  },
  {
    href: "/admin/unmapped-jobs",
    label: "Unmapped Jobs",
    icon: ListChecks,
    ability: { action: "manage", subject: "UnmappedJob" },
  },
  {
    href: "/admin/adjustments",
    label: "Adjustments",
    icon: Coins,
    ability: { action: "manage", subject: "Adjustment" },
  },
  { href: "/settings", label: "Settings", icon: Settings },
];
