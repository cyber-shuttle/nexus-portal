"use client";

import * as React from "react";
import { toast } from "sonner";
import { ApiError } from "@shared/api/client";
import { Button } from "@/shared/ui/button";
import { Label } from "@/shared/ui/label";
import { SideDrawer } from "@/shared/ui/SideDrawer";
import { Input } from "@/shared/ui/input";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/shared/ui/select";
import { MEMBERSHIP_ROLE_LABELS, type MembershipRole } from "../roles";
import { useCreateMembership } from "../queries";
import type { User } from "../schemas";
import { UserSearchCombobox } from "./UserSearchCombobox";

export type AddMemberDrawerProps = {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  allocationId: string;
  allocationEndTime: string;
  excludeUserIds: string[];
};

export function AddMemberDrawer({
  open,
  onOpenChange,
  allocationId,
  allocationEndTime,
  excludeUserIds,
}: AddMemberDrawerProps) {
  const [user, setUser] = React.useState<User | null>(null);
  const [endTime, setEndTime] = React.useState<string>(
    () => allocationEndTime.slice(0, 10),
  );
  const [role, setRole] = React.useState<MembershipRole>("user");
  const createMutation = useCreateMembership();

  React.useEffect(() => {
    if (!open) {
      setUser(null);
      setEndTime(allocationEndTime.slice(0, 10));
      setRole("user");
    }
  }, [open, allocationEndTime]);

  async function onSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!user) {
      toast.error("Pick a user to add.");
      return;
    }
    try {
      await createMutation.mutateAsync({
        compute_allocation_id: allocationId,
        user_id: user.id,
        start_time: new Date().toISOString(),
        end_time: new Date(endTime).toISOString(),
        membership_status: "ACTIVE",
        portal_role: role,
      });
      toast.success(`${user.first_name} ${user.last_name} added`);
      onOpenChange(false);
    } catch (err) {
      const msg =
        err instanceof ApiError ? `Failed (${err.status}): ${err.message}` : "Failed to add member";
      toast.error(msg);
    }
  }

  return (
    <SideDrawer open={open} onOpenChange={onOpenChange} title="Add member">
      <form onSubmit={onSubmit} className="space-y-5" aria-label="Add member form">
        <UserSearchCombobox
          id="member-user"
          label="User"
          value={user}
          onChange={setUser}
          excludeIds={excludeUserIds}
        />
        <div className="space-y-1.5">
          <Label htmlFor="member-role">Role</Label>
          <Select value={role} onValueChange={(v) => setRole(v as MembershipRole)}>
            <SelectTrigger id="member-role" aria-label="Role">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              {(Object.keys(MEMBERSHIP_ROLE_LABELS) as MembershipRole[]).map((r) => (
                <SelectItem key={r} value={r}>
                  {MEMBERSHIP_ROLE_LABELS[r]}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
          <p className="text-xs text-muted-foreground">
            Stored portal-side until the backend grows a role column on
            ComputeAllocationMembership.
          </p>
        </div>
        <div className="space-y-1.5">
          <Label htmlFor="member-end">Membership end date</Label>
          <Input
            id="member-end"
            type="date"
            value={endTime}
            onChange={(e) => setEndTime(e.currentTarget.value)}
          />
          <p className="text-xs text-muted-foreground">
            Defaults to the allocation end date. Resource overrides can be set after the member is
            added.
          </p>
        </div>
        <div className="flex items-center justify-end gap-2 pt-2">
          <Button type="button" variant="ghost" onClick={() => onOpenChange(false)}>
            Cancel
          </Button>
          <Button type="submit" disabled={createMutation.isPending || !user}>
            {createMutation.isPending ? "Adding…" : "Add member"}
          </Button>
        </div>
      </form>
    </SideDrawer>
  );
}
