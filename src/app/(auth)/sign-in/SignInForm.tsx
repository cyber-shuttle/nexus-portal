"use client";

import { useState } from "react";
import { signIn } from "next-auth/react";
import { useRouter, useSearchParams } from "next/navigation";
import { Button } from "@/shared/ui/button";
import { Input } from "@/shared/ui/input";
import { Label } from "@/shared/ui/label";

const personas = [
  { id: "researcher", email: "researcher@nexus.local", label: "Researcher" },
  { id: "pi", email: "pi@nexus.local", label: "Principal Investigator" },
  { id: "admin", email: "admin@nexus.local", label: "Site Admin" },
];

export function SignInForm() {
  const router = useRouter();
  const params = useSearchParams();
  const callbackUrl = params.get("callbackUrl") ?? "/home";

  const [email, setEmail] = useState("");
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const submit = async (loginEmail: string) => {
    if (!loginEmail) {
      setError("Email is required");
      return;
    }
    setError(null);
    setSubmitting(true);
    const res = await signIn("credentials", {
      email: loginEmail,
      password: "dev",
      redirect: false,
      callbackUrl,
    });
    setSubmitting(false);
    if (res?.error) {
      setError("Sign in failed");
      return;
    }
    router.push(res?.url ?? callbackUrl);
    router.refresh();
  };

  return (
    <div className="flex flex-col gap-5">
      <div className="grid grid-cols-1 gap-2">
        {personas.map((p) => (
          <Button
            key={p.id}
            variant="outline"
            disabled={submitting}
            onClick={() => void submit(p.email)}
            className="justify-start"
          >
            <span className="font-medium">{p.label}</span>
            <span className="ml-auto text-xs text-muted-foreground">{p.email}</span>
          </Button>
        ))}
      </div>

      <div className="flex items-center gap-3 text-xs uppercase tracking-wide text-muted-foreground">
        <div className="h-px flex-1 bg-border" />
        <span>or any cluster user</span>
        <div className="h-px flex-1 bg-border" />
      </div>

      <form
        className="flex flex-col gap-3"
        onSubmit={(e) => {
          e.preventDefault();
          void submit(email);
        }}
      >
        <div className="flex flex-col gap-2">
          <Label htmlFor="email">Email</Label>
          <Input
            id="email"
            type="email"
            placeholder="user@your-cluster.edu"
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            autoComplete="email"
            disabled={submitting}
          />
        </div>
        {error && <p className="text-sm text-destructive">{error}</p>}
        <Button type="submit" disabled={submitting}>
          {submitting ? "Signing in..." : "Continue"}
        </Button>
      </form>
    </div>
  );
}
