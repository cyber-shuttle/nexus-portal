import Link from "next/link";

export default function NotFoundPage() {
  return (
    <main
      role="main"
      className="flex min-h-[60vh] flex-col items-center justify-center gap-4 px-6 py-12 text-center"
    >
      <p className="font-mono text-sm text-muted-foreground">404</p>
      <h1 className="font-display text-3xl font-bold tracking-tight">Page not found</h1>
      <p className="max-w-md text-sm text-muted-foreground">
        The page you're looking for isn't part of the Nexus portal. The URL may have changed, or the
        resource may have been removed.
      </p>
      <Link
        href="/home"
        className="inline-flex items-center rounded-md bg-primary px-4 py-2 text-sm font-medium text-primary-foreground hover:opacity-90 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
      >
        Back to overview
      </Link>
    </main>
  );
}
