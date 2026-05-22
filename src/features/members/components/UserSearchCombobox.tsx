"use client";

import { Input } from "@/shared/ui/input";
import { Label } from "@/shared/ui/label";
import * as React from "react";
import { useSearchUsers } from "../queries";
import type { User } from "../schemas";

export type UserSearchComboboxProps = {
  id: string;
  label: string;
  value: User | null;
  onChange: (user: User | null) => void;
  excludeIds?: string[];
};

export function UserSearchCombobox({
  id,
  label,
  value,
  onChange,
  excludeIds = [],
}: UserSearchComboboxProps) {
  const [query, setQuery] = React.useState("");
  const [open, setOpen] = React.useState(false);

  const { data: results, isFetching } = useSearchUsers(query, open);
  const filtered = (results ?? []).filter((u) => !excludeIds.includes(u.id));

  return (
    <div className="space-y-1.5">
      <Label htmlFor={id}>{label}</Label>
      {value ? (
        <div className="flex items-center justify-between rounded-md border bg-muted/30 px-3 py-2">
          <div>
            <p className="text-sm font-medium">
              {value.first_name} {value.last_name}
            </p>
            <p className="text-xs text-muted-foreground">{value.email}</p>
          </div>
          <button
            type="button"
            className="text-xs text-nexus-blue-700 hover:underline"
            onClick={() => {
              onChange(null);
              setQuery("");
            }}
          >
            Change
          </button>
        </div>
      ) : (
        <div className="relative">
          <Input
            id={id}
            type="search"
            placeholder="Search by name or email…"
            value={query}
            autoComplete="off"
            onChange={(e) => {
              setQuery(e.currentTarget.value);
              setOpen(true);
            }}
            onFocus={() => setOpen(true)}
            onBlur={() => window.setTimeout(() => setOpen(false), 150)}
          />
          {open && query.trim().length >= 2 ? (
            <div className="absolute left-0 right-0 z-10 mt-1 max-h-64 overflow-auto rounded-md border bg-popover p-1 shadow-md">
              {isFetching ? (
                <p className="px-2 py-1.5 text-xs text-muted-foreground">Searching…</p>
              ) : filtered.length === 0 ? (
                <p className="px-2 py-1.5 text-xs text-muted-foreground">No matches.</p>
              ) : (
                filtered.map((u) => (
                  <button
                    key={u.id}
                    type="button"
                    data-testid="user-option"
                    className="flex w-full flex-col items-start rounded px-2 py-1.5 text-left text-sm hover:bg-muted"
                    onMouseDown={(e) => {
                      e.preventDefault();
                      onChange(u);
                      setOpen(false);
                      setQuery("");
                    }}
                  >
                    <span className="font-medium">
                      {u.first_name} {u.last_name}
                    </span>
                    <span className="text-xs text-muted-foreground">{u.email}</span>
                  </button>
                ))
              )}
            </div>
          ) : null}
        </div>
      )}
    </div>
  );
}
