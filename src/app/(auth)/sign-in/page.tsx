import { Suspense } from "react";
import { serverEnv } from "@/lib/env";
import { SignInForm } from "./SignInForm";

export const metadata = {
  title: "Sign in · Nexus Portal",
};

export default function SignInPage() {
  const githubEnabled = !!(
    serverEnv.GITHUB_OAUTH_CLIENT_ID && serverEnv.GITHUB_OAUTH_CLIENT_SECRET
  );
  return (
    <div className="flex min-h-screen items-center justify-center bg-muted px-6 py-12">
      <div className="w-full max-w-md rounded-2xl border border-border bg-card p-8 shadow-sm">
        <div className="mb-6 flex flex-col items-start gap-1">
          <span className="font-display text-2xl font-extrabold uppercase tracking-tight text-brand">
            Nexus
          </span>
          <h1 className="text-xl font-semibold tracking-tight">Sign in</h1>
          <p className="text-sm text-muted-foreground">Pick your role to continue.</p>
        </div>
        <Suspense fallback={null}>
          <SignInForm githubEnabled={githubEnabled} />
        </Suspense>
      </div>
    </div>
  );
}
