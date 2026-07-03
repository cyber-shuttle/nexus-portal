"use client";

import { Button } from "@/shared/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/shared/ui/dialog";
import { Input } from "@/shared/ui/input";
import { Label } from "@/shared/ui/label";
import * as React from "react";
import type { Permission } from "./permissions-data";

function slugify(label: string) {
  return label
    .trim()
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "_")
    .replace(/(^_|_$)/g, "");
}

export function AddPermissionDialog({
  open,
  onOpenChange,
  subjectLabel,
  onAdd,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  subjectLabel: string;
  onAdd: (permission: Permission) => void;
}) {
  const [label, setLabel] = React.useState("");

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    const trimmed = label.trim();
    if (!trimmed) return;
    onAdd({ key: `${slugify(trimmed)}-${Math.round(performance.now())}`, label: trimmed });
    setLabel("");
    onOpenChange(false);
  };

  return (
    <Dialog
      open={open}
      onOpenChange={(next) => {
        if (!next) setLabel("");
        onOpenChange(next);
      }}
    >
      <DialogContent>
        <form onSubmit={handleSubmit}>
          <DialogHeader>
            <DialogTitle>Add Permission</DialogTitle>
            <DialogDescription>Grant an additional permission to {subjectLabel}.</DialogDescription>
          </DialogHeader>
          <div className="space-y-1.5 py-1">
            <Label htmlFor="permission-label">Permission name</Label>
            <Input
              id="permission-label"
              autoFocus
              placeholder="e.g. Export Billing Reports"
              value={label}
              onChange={(e) => setLabel(e.target.value)}
            />
          </div>
          <DialogFooter>
            <Button type="button" variant="outline" onClick={() => onOpenChange(false)}>
              Cancel
            </Button>
            <Button type="submit" disabled={!label.trim()}>
              Add Permission
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}
