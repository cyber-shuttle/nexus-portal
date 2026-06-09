# ADR-0003: MSW intercepts in the browser; the proxy still goes to the real backend

**Status:** Accepted
**Date:** 2026-05

## Context

The portal supports two run modes: fully local (no backend running) and against a real backend. We wanted one switch (`NEXT_PUBLIC_PORTAL_USE_MSW=true`) to toggle between them without changing app code, plus deterministic fixtures so screenshots and e2e tests stay stable.

MSW (Mock Service Worker) was the natural fit, but where to intercept is a real decision. MSW can run in the browser (via Service Worker) or in Node (via request interception in `instrumentation.ts`). Each catches different traffic.

## Decision

When `NEXT_PUBLIC_PORTAL_USE_MSW=true`:

- The browser worker (`src/mocks/browser.ts`) intercepts every `apiFetch` call the React tree makes.
- The Next.js server-side proxy at `src/app/api/v1/[...path]/route.ts` is *not* affected by the browser worker. It always forwards to the upstream defined by `CORE_API_BASE_URL` / `AMIE_API_BASE_URL` / `SIGNER_API_BASE_URL`.
- A Node-side interceptor in `src/instrumentation.ts` handles SSR fetches inside the Next process.

Seed data uses a deterministic seeded RNG (`makeRng`) so fixtures are reproducible across hot reloads and tests.

E2e tests always run with MSW on (forced in `playwright.config.ts`).

## Consequences

- Day-to-day UI development needs zero backend: `pnpm dev` boots the worker on hydrate.
- `curl http://localhost:3000/api/v1/admin/...` from a terminal does **not** hit MSW — it flows through the proxy to whatever's on `CORE_API_BASE_URL` (default `http://localhost:8080`). This trips up contributors expecting MSW to intercept everything. It's the right tradeoff: the proxy is a real production code path and we want it exercised against a real backend when one's available.
- Adding a new mocked endpoint = add a handler in `src/mocks/handlers/`, add it to the aggregator, add a fixture under `src/features/<name>/__fixtures__/`. Write a direct-resolver test in `src/mocks/handlers/__tests__/` so handler behavior is unit-tested without booting the worker.
- Don't add new MSW handlers to the Node-side interceptor for tests. Browser-mode is the path the React tree uses; Node interceptors are for SSR only.
