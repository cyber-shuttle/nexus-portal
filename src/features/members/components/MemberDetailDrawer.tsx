"use client";

import {
  useMembershipOverrides,
  useUserIdentities,
} from "../queries";
import type { AllocationMemberRow } from "../queries";
import { SideDrawer } from "@/shared/ui/SideDrawer";
import { CenteredSpinner } from "@/shared/ui/Loading";
import { EmptyState } from "@/shared/ui/EmptyState";

export type MemberDetailDrawerProps = {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  member: AllocationMemberRow | null;
};

function fullName(row: AllocationMemberRow): string {
  if (!row.user) return row.membership.user_id;
  const parts = [row.user.first_name, row.user.middle_name, row.user.last_name].filter(Boolean);
  return parts.length > 0 ? parts.join(" ") : row.user.email;
}

export function MemberDetailDrawer({ open, onOpenChange, member }: MemberDetailDrawerProps) {
  const identitiesQuery = useUserIdentities(member?.membership.user_id);
  const overridesQuery = useMembershipOverrides(member?.membership.id);

  return (
    <SideDrawer
      open={open}
      onOpenChange={onOpenChange}
      title={member ? fullName(member) : "Member"}
      description={member?.user?.email}
    >
      {!member ? null : (
        <div className="space-y-6">
          <section>
            <h3 className="font-heading text-sm font-semibold uppercase tracking-wide text-muted-foreground">
              Membership
            </h3>
            <dl className="mt-2 grid grid-cols-2 gap-2 text-sm">
              <dt className="text-muted-foreground">Status</dt>
              <dd>{member.membership.membership_status}</dd>
              <dt className="text-muted-foreground">Member since</dt>
              <dd>{new Date(member.membership.start_time).toLocaleDateString()}</dd>
              <dt className="text-muted-foreground">Ends</dt>
              <dd>{new Date(member.membership.end_time).toLocaleDateString()}</dd>
            </dl>
          </section>

          <section>
            <h3 className="font-heading text-sm font-semibold uppercase tracking-wide text-muted-foreground">
              External identities
            </h3>
            <div className="mt-2">
              {identitiesQuery.isLoading ? (
                <CenteredSpinner />
              ) : identitiesQuery.data && identitiesQuery.data.length > 0 ? (
                <ul className="divide-y divide-border/60 rounded-md border">
                  {identitiesQuery.data.map((identity) => (
                    <li key={identity.id} className="px-3 py-2 text-sm">
                      <div className="font-medium">{identity.source}</div>
                      <div className="text-xs text-muted-foreground">{identity.external_id}</div>
                      {identity.email ? (
                        <div className="text-xs text-muted-foreground">{identity.email}</div>
                      ) : null}
                    </li>
                  ))}
                </ul>
              ) : (
                <p className="text-sm text-muted-foreground">No external identities linked.</p>
              )}
            </div>
          </section>

          <section>
            <h3 className="font-heading text-sm font-semibold uppercase tracking-wide text-muted-foreground">
              Resource overrides
            </h3>
            <div className="mt-2">
              {overridesQuery.isLoading ? (
                <CenteredSpinner />
              ) : overridesQuery.data && overridesQuery.data.length > 0 ? (
                <ul className="divide-y divide-border/60 rounded-md border">
                  {overridesQuery.data.map((override) => (
                    <li key={override.id} className="px-3 py-2 text-sm">
                      <div className="flex justify-between">
                        <span className="text-muted-foreground">Resource</span>
                        <span className="font-medium">
                          {override.compute_allocation_resource_id}
                        </span>
                      </div>
                      <div className="flex justify-between">
                        <span className="text-muted-foreground">Amount override</span>
                        <span>{override.override_resource_amount}</span>
                      </div>
                      <div className="flex justify-between">
                        <span className="text-muted-foreground">Time override (min)</span>
                        <span>{override.override_resource_time}</span>
                      </div>
                    </li>
                  ))}
                </ul>
              ) : (
                <EmptyState
                  heading="No overrides"
                  description="This member uses the default resource shares."
                />
              )}
            </div>
          </section>
        </div>
      )}
    </SideDrawer>
  );
}
