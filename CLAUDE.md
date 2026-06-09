# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## What this is

Web portal for **Apache Custos / Nexus** — allocation management, identity, signer operations, and admin tooling for HPC sites. Backend lives at `../airavata-custos/` (sibling directory).

## Commands

```bash
pnpm dev            # Start dev server (localhost:3000)
pnpm build          # Production build
pnpm lint           # Biome lint
pnpm format         # Biome format (writes in place)
pnpm typecheck      # tsc --noEmit
pnpm test           # Vitest (unit, run once)
pnpm test:watch     # Vitest watch mode
pnpm test:e2e       # Playwright e2e tests
pnpm verify         # lint + typecheck + test + build (full gate)
```

Run a single unit test file:
```bash
pnpm vitest run src/lib/__tests__/env.test.ts
```

Run a single e2e test:
```bash
pnpm playwright test tests/some.e2e.ts
```

## Local development setup

Copy `.env.example` to `.env.local`. The defaults work out of the box:

- `PORTAL_AUTH_MODE=dev` — uses a dev credentials sign-in (no real OIDC). Dev personas: `researcher@nexus.local`, `pi@nexus.local`, `admin@nexus.local` (any password).
- `NEXT_PUBLIC_PORTAL_USE_MSW=true` — MSW intercepts all `/api/v1/*` calls; no real backend needed.

To test real OIDC, set `PORTAL_AUTH_MODE=oidc` and fill `OIDC_ISSUER_URL`, `OIDC_CLIENT_ID`, `OIDC_CLIENT_SECRET`, `NEXUS_ALLOWED_EMAILS`. The env schema in `src/lib/env.ts` will fail-fast at boot if any of these are missing.

## Architecture

### Next.js App Router layout

```
src/app/
  (auth)/          — sign-in page (credentials / OIDC)
  (marketing)/     — landing page
  (portal)/        — authenticated portal shell
    admin/         — admin-only area
    allocations/
    analytics/
    change-requests/
    clients/
    home/
    projects/
    proposals/
    ...
  api/
    auth/[...nextauth]/  — NextAuth handler
    feedback/            — POST: creates GitHub issue with screenshot
    v1/[...path]/        — transparent proxy to backend APIs
```

### Backend proxy

`src/app/api/v1/[...path]/route.ts` proxies all frontend API calls to one of three backends based on path prefix:

- `amie/*` → `AMIE_API_BASE_URL`
- `signer/*` or `certificates/*` → `SIGNER_API_BASE_URL`
- everything else → `CORE_API_BASE_URL`

Admin paths (`admin/*`, `amie/admin/*`) use `X-Client-Id` / `X-Client-Secret` headers; all other paths forward the session Bearer token. The client always calls `/api/v1/<path>` via `apiFetch` in `src/shared/api/client.ts`.

### Feature structure

Each feature in `src/features/<name>/` follows the same internal shape:

```
schemas.ts    — Zod schemas + inferred TypeScript types
types.ts      — non-schema types (query params, discriminated unions)
api.ts        — apiFetch calls, each validates response with Zod schema
queries.ts    — TanStack Query hooks (useQuery / useMutation) + query key factories
components/   — React components scoped to this feature
__tests__/    — Vitest unit tests
```

Features never import from each other; shared concerns go to `src/shared/`.

### Shared layer (`src/shared/`)

- `api/client.ts` — `apiFetch`: adds `/api/v1` prefix, attaches headers, throws `ApiError` on non-2xx.
- `auth/auth.ts` — NextAuth config. Dev mode uses a `Credentials` provider; OIDC mode uses Keycloak + optional GitHub OAuth.
- `casl/abilities.ts` — CASL `defineAbility()`. Roles: `guest | user | pi | co_pi | allocation_manager` (portal axis) + `admin` (system axis). Permissions are derived from the session at page load; CASL `Can` component is re-exported from here.
- `layout/nav.ts` — `portalNav` array defines sidebar items with optional `ability` gate.
- `providers/Providers.tsx` — Root provider tree: `SessionProvider → ThemeProvider → MswProvider → QueryProvider → AbilityProvider → TooltipProvider`.
- `ui/` — shadcn/ui components (style: `base-nova`). Add new components with `pnpm dlx shadcn@latest add <component>`.

### MSW (Mock Service Worker)

`NEXT_PUBLIC_PORTAL_USE_MSW=true` boots MSW in browser via `src/mocks/browser.ts`. Handlers live in `src/mocks/handlers/`. Seed data helpers in `src/mocks/seed/` use a deterministic seeded RNG (`makeRng`) so data is stable across hot reloads.

E2e tests always run with MSW on (forced in `playwright.config.ts`).

### Design tokens

CSS custom properties in `design-tokens/` are the source of truth for color, spacing, radius, and typography. `design-tokens/tokens.json` is the machine-readable version. A Vitest smoke test (`src/shared/__tests__/tokens.test.ts`) guards against accidental regressions.

## Code conventions

- **Biome** for lint + format. Config: `biome.json`. `noExplicitAny` is an error; `useImportType` is a warning (off inside `src/shared/ui/**`).
- **Zod** validation happens at the API boundary only (in `api.ts` files). Components receive typed data; do not re-validate inside components.
- **Query keys** follow the factory pattern: each feature exports a `<feature>Keys` object with `all`, `list(params)`, `detail(id)` methods.
- **CASL** permissions are checked with the `<Can>` component or `useAbility()` hook. Do not gate UI with session role strings directly.
- Server-only code (NextAuth, backend proxy, env validation) uses the `"server-only"` package import to prevent accidental bundling into client code.
- Every commit must leave `pnpm build` and `pnpm dev` green (README hard requirement).

## Feedback widget

`src/features/feedback/` implements an in-app feedback overlay that captures a screenshot (html2canvas-pro) and files a GitHub issue. The API route (`/api/feedback`) commits the screenshot image to the repo and creates the issue. In dev without `FEEDBACK_GITHUB_TOKEN`, the route returns a mock issue URL so the UI flow works locally.

## Docs

`docs/` contains gate specs that define phase-by-phase acceptance criteria. Cross-reference these before implementing a new section of the portal:

- `docs/phase-gates/` — feature completeness gates by phase
- `docs/style-gates/` — design/UI quality gates
- `docs/backend-contracts/` — API shapes negotiated with the backend team
- `docs/analytics-gates/`, `docs/feedback-gates/`, `docs/oidc-gates/`, `docs/team-feedback-gates/` — subsystem-specific gates
