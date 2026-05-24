"use client";

import { Button } from "@/shared/ui/button";
import { signIn } from "next-auth/react";
import { useSearchParams } from "next/navigation";
import { useState } from "react";
import { SignInErrorBanner } from "./SignInErrorBanner";

type Persona = "researcher" | "pi" | "admin";

const personas: Array<{ id: Persona; email: string; label: string }> = [
  { id: "researcher", email: "researcher@nexus.local", label: "Researcher" },
  { id: "pi", email: "pi@nexus.local", label: "Principal Investigator" },
  { id: "admin", email: "admin@nexus.local", label: "Site Admin" },
];

export type SignInFormProps = {
  githubEnabled: boolean;
};

export function SignInForm({ githubEnabled }: SignInFormProps) {
  const params = useSearchParams();
  const callbackUrl = params.get("callbackUrl") ?? "/home";
  const errorParam = params.get("error");
  const deniedEmail = params.get("email") ?? undefined;

  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const pick = async (persona: Persona) => {
    setError(null);
    setSubmitting(true);
    // Auth mode is read at module-load via NEXT_PUBLIC_PORTAL_AUTH_MODE so
    // a single deploy can flip dev↔oidc without rebuilding this component.
    if (process.env.NEXT_PUBLIC_PORTAL_AUTH_MODE === "oidc") {
      // Short-lived cookie carries the persona pick across the OIDC redirect;
      // the jwt callback reads and clears it. Secure + SameSite=Lax matches
      // NextAuth's own session-cookie posture.
      document.cookie = `nexus_pending_persona=${persona}; Max-Age=300; Path=/; SameSite=Lax; Secure`;
      await signIn("oidc", { callbackUrl });
      return;
    }
    const preset = personas.find((p) => p.id === persona);
    const res = await signIn("credentials", {
      email: preset?.email ?? "",
      password: "dev",
      redirect: false,
      callbackUrl,
    });
    setSubmitting(false);
    if (!res || res.error) {
      setError(res?.error ?? "Sign in failed");
      return;
    }
    window.location.assign(res.url ?? callbackUrl);
  };

  const continueWithGithub = async () => {
    setError(null);
    setSubmitting(true);
    await signIn("github", { callbackUrl });
  };

  return (
    <div className="flex flex-col gap-5">
      {errorParam === "not_allowed" && <SignInErrorBanner email={deniedEmail} />}

      <div className="grid grid-cols-1 gap-2">
        {personas.map((p) => (
          <Button
            key={p.id}
            variant="outline"
            disabled={submitting}
            onClick={() => void pick(p.id)}
            className="justify-start"
          >
            <span className="font-medium">{p.label}</span>
            <span className="ml-auto text-xs text-muted-foreground">{p.email}</span>
          </Button>
        ))}
      </div>

      {githubEnabled && (
        <>
          <hr className="border-border" />
          <div className="flex flex-col gap-2">
            <Button
              variant="outline"
              disabled={submitting}
              onClick={() => void continueWithGithub()}
              className="justify-center"
            >
              Continue with GitHub
            </Button>
            <p className="text-xs text-muted-foreground">
              Required to enable Suggestion mode and have your feedback attributed to your GitHub
              account.
            </p>
            <p className="text-[11px] text-muted-foreground/80">
              We only request <code>repo</code> scope to file issues in nexus-portal. We never read
              or write any other repository.
            </p>
          </div>
        </>
      )}

      {error && <p className="text-sm text-destructive">{error}</p>}
    </div>
  );
}
