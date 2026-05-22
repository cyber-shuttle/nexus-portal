import type { LucideIcon } from "lucide-react";
import {
  BadgeCheck,
  ClipboardList,
  FileText,
  GitPullRequest,
  LayoutDashboard,
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
  { href: "/settings", label: "Settings", icon: Settings },
];
