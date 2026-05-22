"use client";

import { ErrorState } from "@/shared/ui/ErrorState";
import { CenteredSpinner } from "@/shared/ui/Loading";
import { Button } from "@/shared/ui/button";
import { Card } from "@/shared/ui/card";
import { Input } from "@/shared/ui/input";
import { Label } from "@/shared/ui/label";
import { useTheme } from "next-themes";
import { useSession } from "next-auth/react";
import * as React from "react";
import { toast } from "sonner";
import { useMyIdentities, useMyPreferences, useUpdateMyPreferences } from "../queries";

const TIMEZONES = ["UTC", "America/Chicago", "America/New_York", "America/Los_Angeles", "Europe/London", "Asia/Tokyo"];

export function SettingsPage() {
  const { data: session } = useSession();
  const prefsQuery = useMyPreferences();
  const updatePrefs = useUpdateMyPreferences();
  const identitiesQuery = useMyIdentities();
  const { theme, setTheme, resolvedTheme } = useTheme();
  const [mounted, setMounted] = React.useState(false);
  React.useEffect(() => setMounted(true), []);

  const [timezone, setTimezone] = React.useState<string>("");
  const [notifyOnCr, setNotifyOnCr] = React.useState<boolean>(false);
  const [notifyOnProposal, setNotifyOnProposal] = React.useState<boolean>(false);

  React.useEffect(() => {
    if (prefsQuery.data) {
      setTimezone(prefsQuery.data.timezone);
      setNotifyOnCr(prefsQuery.data.notify_on_change_request_decided);
      setNotifyOnProposal(prefsQuery.data.notify_on_proposal_decided);
    }
  }, [prefsQuery.data]);

  if (prefsQuery.isLoading) return <CenteredSpinner label="Loading settings" />;
  if (prefsQuery.error) {
    return (
      <ErrorState
        message={(prefsQuery.error as Error).message ?? "Failed to load settings"}
        onRetry={() => prefsQuery.refetch()}
      />
    );
  }

  function save() {
    updatePrefs.mutate(
      {
        timezone,
        notify_on_change_request_decided: notifyOnCr,
        notify_on_proposal_decided: notifyOnProposal,
      },
      {
        onSuccess: () => toast.success("Settings saved"),
        onError: (err) =>
          toast.error(err instanceof Error ? err.message : "Failed to save settings"),
      },
    );
  }

  return (
    <div className="mx-auto max-w-3xl space-y-8 py-2">
      <header className="space-y-1">
        <h1 className="font-display text-[28px] font-bold leading-tight">Settings</h1>
        <p className="text-sm text-muted-foreground">
          Manage your profile, connected identities, theme, and notification preferences.
        </p>
      </header>

      <section aria-labelledby="profile-heading" className="space-y-3">
        <h2 id="profile-heading" className="font-heading text-lg font-semibold">
          Profile
        </h2>
        {/* Card sections separated by border-b dividers per spec §9.2. */}
        <Card className="gap-0 divide-y divide-border py-0">
          <div className="grid gap-3 p-5 md:grid-cols-2">
            <div className="space-y-1">
              <Label htmlFor="profile-name">Name</Label>
              <Input id="profile-name" readOnly value={session?.user?.name ?? ""} />
            </div>
            <div className="space-y-1">
              <Label htmlFor="profile-email">Email</Label>
              <Input id="profile-email" readOnly value={session?.user?.email ?? ""} />
            </div>
          </div>
          <div className="p-5">
            <p className="mb-2 text-sm font-medium">Connected identities</p>
            {identitiesQuery.isLoading ? (
              <p className="text-xs text-muted-foreground">Loading…</p>
            ) : identitiesQuery.data && identitiesQuery.data.length > 0 ? (
              <ul className="divide-y divide-border rounded-md border bg-muted/20 text-sm">
                {identitiesQuery.data.map((id) => (
                  <li key={id.id} className="flex items-center justify-between px-3 py-2">
                    <span>
                      <span className="font-medium">{id.source}</span> ·{" "}
                      <span className="font-mono text-xs">{id.external_id}</span>
                    </span>
                    <span className="text-xs text-muted-foreground">
                      {id.email ?? id.oidc_sub ?? ""}
                    </span>
                  </li>
                ))}
              </ul>
            ) : (
              <p className="text-xs text-muted-foreground">No identities linked to this account.</p>
            )}
          </div>
        </Card>
      </section>

      <section aria-labelledby="prefs-heading" className="space-y-3">
        <h2 id="prefs-heading" className="font-heading text-lg font-semibold">
          Preferences
        </h2>
        <Card className="gap-0 divide-y divide-border py-0">
          <fieldset className="space-y-2 p-5">
            <legend className="text-sm font-medium">Theme</legend>
            <div role="radiogroup" aria-label="Theme" className="flex flex-wrap gap-3">
              {(["light", "dark", "system"] as const).map((t) => (
                <label
                  key={t}
                  className="flex cursor-pointer items-center gap-2 rounded-md border bg-card px-3 py-2 text-sm"
                >
                  <input
                    type="radio"
                    name="theme"
                    value={t}
                    checked={mounted ? theme === t : false}
                    onChange={() => setTheme(t)}
                  />
                  <span className="capitalize">{t}</span>
                </label>
              ))}
            </div>
            <p className="text-xs text-muted-foreground">
              Resolved theme: {mounted ? (resolvedTheme ?? "system") : "—"}
            </p>
          </fieldset>

          <div className="space-y-1 p-5">
            <Label htmlFor="prefs-tz">Timezone</Label>
            <select
              id="prefs-tz"
              value={timezone}
              onChange={(e) => setTimezone(e.currentTarget.value)}
              className="rounded-md border bg-background px-3 py-1.5 text-sm"
            >
              {TIMEZONES.map((tz) => (
                <option key={tz} value={tz}>
                  {tz}
                </option>
              ))}
            </select>
          </div>

          <fieldset className="space-y-2 p-5">
            <legend className="text-sm font-medium">Email me when…</legend>
            <label className="flex items-center gap-2 text-sm">
              <input
                type="checkbox"
                checked={notifyOnCr}
                onChange={(e) => setNotifyOnCr(e.currentTarget.checked)}
              />
              My change request is approved or rejected
            </label>
            <label className="flex items-center gap-2 text-sm">
              <input
                type="checkbox"
                checked={notifyOnProposal}
                onChange={(e) => setNotifyOnProposal(e.currentTarget.checked)}
              />
              My proposal status changes
            </label>
          </fieldset>

          <div className="flex justify-end p-5">
            <Button onClick={save} disabled={updatePrefs.isPending}>
              {updatePrefs.isPending ? "Saving…" : "Save settings"}
            </Button>
          </div>
        </Card>
      </section>
    </div>
  );
}
