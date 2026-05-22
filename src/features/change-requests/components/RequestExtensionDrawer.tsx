"use client";

import { SideDrawer } from "@/shared/ui/SideDrawer";
import { RequestExtensionForm } from "./RequestExtensionForm";

export type RequestExtensionDrawerProps = {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  allocationId: string;
  requesterId: string;
  currentSuAmount: number;
};

export function RequestExtensionDrawer({
  open,
  onOpenChange,
  allocationId,
  requesterId,
  currentSuAmount,
}: RequestExtensionDrawerProps) {
  return (
    <SideDrawer
      open={open}
      onOpenChange={onOpenChange}
      title="Request extension"
      description="Submit a change request to extend SUs or end date"
    >
      <RequestExtensionForm
        allocationId={allocationId}
        requesterId={requesterId}
        currentSuAmount={currentSuAmount}
        onSuccess={() => onOpenChange(false)}
        onCancel={() => onOpenChange(false)}
      />
    </SideDrawer>
  );
}
