import { BookUser, Globe, KeyRound } from "lucide-react";
import type { ElementType } from "react";
import { UserManagementNav } from "../UserManagementNav";

type ExternalIdentity = {
  source: string;
  externalId: string;
  email: string;
  icon: ElementType;
  accent: string;
  accentFg: string;
};

const EXTERNAL_IDENTITIES: ExternalIdentity[] = [
  {
    source: "ACCESS",
    externalId: "rgao-access-001",
    email: "nipuna@access-ci.org",
    icon: Globe,
    accent: "bg-[color:var(--nexus-blue-50)]",
    accentFg: "text-[color:var(--nexus-blue-600)]",
  },
  {
    source: "CILogon",
    externalId: "cilogon-uid-7842",
    email: "nipuna@cilogon.org",
    icon: KeyRound,
    accent: "bg-[color:var(--nexus-green-50)]",
    accentFg: "text-[color:var(--nexus-green-700)]",
  },
  {
    source: "ORCID",
    externalId: "0000-0002-1825-0097",
    email: "nipuna@orcid.org",
    icon: BookUser,
    accent: "bg-[color:var(--nexus-purple-50)]",
    accentFg: "text-[color:var(--nexus-purple-700)]",
  },
];

function ExternalIdentityCard({ identity }: { identity: ExternalIdentity }) {
  const Icon = identity.icon;
  return (
    <div className="rounded-xl border border-border bg-card ring-1 ring-foreground/[0.06] overflow-hidden">
      {/* Header */}
      <div className="flex items-center justify-between px-4 py-3 border-b border-border/60">
        <div className="flex items-center gap-2.5">
          <span
            className={`inline-flex h-8 w-8 items-center justify-center rounded-lg ${identity.accent} ${identity.accentFg}`}
          >
            <Icon className="h-4 w-4" strokeWidth={1.75} />
          </span>
          <span className="text-sm font-semibold text-foreground">{identity.source}</span>
        </div>
        <span className="inline-flex items-center gap-1 rounded-full bg-[color:var(--nexus-green-50)] px-2 py-0.5 text-[11px] font-medium text-[color:var(--nexus-green-700)]">
          <span className="h-1.5 w-1.5 rounded-full bg-[color:var(--nexus-green-500)]" />
          Linked
        </span>
      </div>

      {/* Fields */}
      <div className="divide-y divide-border/50">
        <div className="grid grid-cols-[auto_1fr] gap-x-3 px-4 py-2.5">
          <span className="w-24 text-xs text-muted-foreground pt-px">External ID</span>
          <span className="text-xs font-mono text-foreground truncate">{identity.externalId}</span>
        </div>
        <div className="grid grid-cols-[auto_1fr] gap-x-3 px-4 py-2.5">
          <span className="w-24 text-xs text-muted-foreground pt-px">Email</span>
          <span className="text-xs text-foreground truncate">{identity.email}</span>
        </div>
      </div>
    </div>
  );
}

export default function UserIdentitiesPage() {
  return (
    <div className="space-y-4">
      <header className="space-y-1">
        <h1 className="font-display text-[28px] font-bold leading-tight">User Management</h1>
        <p className="text-sm text-muted-foreground">
          Manage user identities, access permissions, and roles across the portal. Control who can
          access resources, configure role assignments, and audit identity records.
        </p>
      </header>
      <UserManagementNav />
      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
        {EXTERNAL_IDENTITIES.map((identity) => (
          <ExternalIdentityCard key={identity.source} identity={identity} />
        ))}
      </div>
    </div>
  );
}
