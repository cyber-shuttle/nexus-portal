import { auth } from "@/shared/auth/auth";

export default async function HomePage() {
  const session = await auth();
  const firstName = session?.user?.name?.split(" ")[0] ?? "there";

  return (
    <div className="mx-auto flex max-w-5xl flex-col gap-6 py-8">
      <div className="flex flex-col gap-2">
        <h1 className="font-display text-3xl font-bold tracking-tight">Welcome, {firstName}</h1>
        <p className="text-base text-muted-foreground">
          Allocation dashboards, change requests, and the rest of the portal land in phase 2.
          The shell, design tokens, and auth are wired.
        </p>
      </div>
      <div className="rounded-2xl border border-dashed border-border bg-card p-10 text-sm text-muted-foreground">
        Phase 0 home placeholder. Persona{" "}
        <span className="font-medium text-foreground">{session?.user?.role ?? "guest"}</span>{" "}
        signed in.
      </div>
    </div>
  );
}
