// Boot the MSW node interceptor so server-side fetches in route handlers
// share the same mock topology the browser worker uses. Test/dev only.
export async function register() {
  if (process.env.NEXT_RUNTIME !== "nodejs") return;
  if (process.env.NEXT_PUBLIC_PORTAL_USE_MSW !== "true") return;
  // Hide the specifier from webpack — msw/node's subpath exports trip the
  // bundler; new Function bypasses webpack and lets Node's loader resolve it.
  const dynamicImport = new Function("s", "return import(s)") as (
    s: string,
  ) => Promise<unknown>;
  const { setupServer } = (await dynamicImport("msw/node")) as typeof import("msw/node");
  const { handlers } = await import("@/mocks/handlers");
  const server = setupServer(...handlers);
  server.listen({ onUnhandledRequest: "bypass" });
}
