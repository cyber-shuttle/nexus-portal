"use client";

import { Button } from "@/shared/ui/button";
import { signOut } from "next-auth/react";

interface SignInErrorBannerProps {
  email?: string;
}

export function SignInErrorBanner({ email }: SignInErrorBannerProps) {
  // signOut first clears the local NextAuth cookie so a stale session does
  // not auto-resume; full reload to /sign-in drops the error query string.
  const retry = async () => {
    await signOut({ redirect: false });
    window.location.assign("/sign-in");
  };

  return (
    <div
      role="alert"
      aria-label="Not on the allowlist"
      className="mb-6 flex flex-col gap-3 rounded-md border border-[color:var(--nexus-red-200)] bg-[color:var(--nexus-red-50)] p-4 text-sm text-[color:var(--nexus-red-700)]"
    >
      <p className="font-semibold">Not on the allowlist</p>
      <p>
        {email ? (
          <>
            <span className="font-medium">{email}</span> is not authorized to sign in.
          </>
        ) : (
          "That account is not authorized to sign in."
        )}{" "}
        If this is unexpected, ask an admin to add your email to the access list.
      </p>
      <div>
        <Button variant="outline" size="sm" onClick={() => void retry()}>
          Try a different account
        </Button>
      </div>
    </div>
  );
}
