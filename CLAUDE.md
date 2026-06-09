# CLAUDE.md

Context for AI assistants (Claude Code, Cursor, etc.) working in this repository. Human contributors should start with [README.md](./README.md) and [docs/README.md](./docs/README.md).

## What this is

Web portal for **Apache Custos / Nexus** — allocation management, identity, signer operations, and admin tooling for HPC sites. Pairs with the Apache Custos backend; expects either a live backend (`CORE_API_BASE_URL` etc.) or the in-repo MSW mock layer.

Domain terms (AMIE, COmanage, packet, allocation, co_pi, …) are defined in [docs/glossary.md](./docs/glossary.md). Read it once before changing anything domain-shaped.

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
pnpm vitest run src/features/tracing/__tests__/schemas.test.ts
```

Run a single e2e test:

```bash
pnpm playwright test tests/admin-traces-list.e2e.ts
```

Every commit must leave `pnpm build` and `pnpm dev` green.

## Local development

Copy `.env.example` to `.env.local`. Defaults work out of the box without a backend:

- `PORTAL_AUTH_MODE=dev` — credentials-based sign-in (no real OIDC). Dev personas: `researcher@nexus.local`, `pi@nexus.local`, `admin@nexus.local` (any password).
- `NEXT_PUBLIC_PORTAL_USE_MSW=true` — MSW intercepts all `/api/v1/*` calls in the browser; no backend required. See [ADR-0003](./docs/adr/0003-msw-browser-only.md) for what MSW does and doesn't intercept.

To test against a real backend, set `PORTAL_AUTH_MODE=oidc` and provide `OIDC_ISSUER_URL`, `OIDC_CLIENT_ID`, `OIDC_CLIENT_SECRET`, plus the backend base URLs. The env schema in `src/lib/env.ts` fails fast at boot if anything required is missing.

## Architecture

### Next.js App Router layout

```
src/app/
  (auth)/          — sign-in (credentials / OIDC)
  (marketing)/     — landing page
  (portal)/        — authenticated portal shell
    admin/         — admin-only area (incl. /admin/traces)
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
    feedback/            — in-app feedback overlay → GitHub issue
    v1/[...path]/        — transparent proxy to backend APIs
```

### Backend proxy

`src/app/api/v1/[...path]/route.ts` proxies frontend API calls to one of three backends based on the path prefix:

- `amie/*` → `AMIE_API_BASE_URL`
- `signer/*` or `certificates/*` → `SIGNER_API_BASE_URL`
- everything else → `CORE_API_BASE_URL`

Admin paths (`admin/*`, `amie/admin/*`) attach `X-Client-Id` / `X-Client-Secret` headers; all other paths forward the user's Bearer token. The client always calls `/api/v1/<path>` via `apiFetch` in `src/shared/api/client.ts`.

### Feature structure

Each feature in `src/features/<name>/` follows the same internal shape:

```
schemas.ts    — Zod schemas + inferred TypeScript types
types.ts      — non-schema types (query params, discriminated unions)
api.ts        — apiFetch calls; each validates response with Zod ([ADR-0002](./docs/adr/0002-zod-at-boundary.md))
queries.ts    — TanStack Query hooks + query key factories
components/   — React components scoped to this feature
__tests__/    — Vitest unit tests
```

Features must not import from each other — see [ADR-0004](./docs/adr/0004-feature-isolation.md). The one documented exception is `src/features/tracing/components/ViewTraceLink.tsx` (cross-feature deep-link primitive).

### Shared layer (`src/shared/`)

- `api/client.ts` — `apiFetch`: prepends `/api/v1`, attaches headers, throws `ApiError` on non-2xx, records the response `X-Trace-Id` on a singleton.
- `auth/auth.ts` — NextAuth v5 config. Dev mode uses a `Credentials` provider; OIDC mode uses Keycloak + optional GitHub OAuth.
- `casl/abilities.ts` — CASL `defineAbility()`. Roles: `guest | user | pi | co_pi | allocation_manager` (portal axis) + `admin` (system axis). See [ADR-0001](./docs/adr/0001-casl-over-role-strings.md) — gate UI with `<Can>` or `useAbility()`, never with raw role strings.
- `layout/nav.ts` — `portalNav` array defines sidebar items with optional `ability` gate.
- `providers/Providers.tsx` — Root provider tree: `SessionProvider → ThemeProvider → MswProvider → QueryProvider → AbilityProvider → TooltipProvider`.
- `hooks/useShallowSearchParams.ts` — drop-in for `useSearchParams()` whose writes don't trigger an RSC roundtrip. See [ADR-0005](./docs/adr/0005-shallow-url-state.md).
- `ui/` — shadcn/ui components (style: `base-nova`). Add new components with `pnpm dlx shadcn@latest add <component>`.

### MSW (Mock Service Worker)

With `NEXT_PUBLIC_PORTAL_USE_MSW=true`, MSW boots in the browser via `src/mocks/browser.ts`. Handlers live in `src/mocks/handlers/`. Seed helpers in `src/mocks/seed/` use a deterministic seeded RNG (`makeRng`) so fixtures stay stable across hot reloads. E2e tests always run with MSW on (forced in `playwright.config.ts`).

Caveat: the browser worker does not intercept server-side fetches. `curl` against `http://localhost:3000/api/v1/...` flows through the proxy to `CORE_API_BASE_URL`, not MSW. The `src/instrumentation.ts` node interceptor handles SSR requests inside the Next process.

### Design tokens

CSS custom properties in `design-tokens/` are the source of truth for color, spacing, radius, and typography. `design-tokens/tokens.json` is the machine-readable version. A Vitest smoke test (`src/shared/__tests__/tokens.test.ts`) guards against accidental regressions.

Light tokens are declared in `:root`; dark overrides live in `.dark`. Both selectors have equal specificity, so order in the source file matters — keep `.dark` overrides after the `:root` block they shadow.

## Code conventions

- **Biome** for lint + format. Config: `biome.json`. `noExplicitAny` is an error; `useImportType` is a warning (off inside `src/shared/ui/**`).
- **Zod** validation happens at the API boundary only ([ADR-0002](./docs/adr/0002-zod-at-boundary.md)).
- **Query keys** follow the factory pattern: each feature exports a `<feature>Keys` object with `all`, `list(params)`, `detail(id)` methods.
- **URL state** uses `useShallowSearchParams` for filter/drawer/tab state ([ADR-0005](./docs/adr/0005-shallow-url-state.md)).
- **CASL** for permission gating ([ADR-0001](./docs/adr/0001-casl-over-role-strings.md)).
- **Server-only code** (NextAuth, backend proxy, env validation) imports `"server-only"` to prevent accidental bundling into client code.

## Pitfalls (things that look right but aren't here)

These are the patterns LLMs and humans both default to that get rejected in review:

- **Don't gate UI with `session.role === "admin"`.** Use `<Can I="manage" a="Site">` or `useAbility()`. The grep `session\.role\s*===` is a red flag in review.
- **Don't re-validate Zod schemas inside components.** Validation is at the API boundary (`api.ts`); components consume typed data and trust it.
- **Don't `router.replace` for filter/drawer/tab state.** Use `useShallowSearchParams`. `router.replace` triggers an RSC roundtrip on every keystroke and the UI feels broken.
- **Don't import across `src/features/<name>/`.** The only sanctioned cross-feature import is `ViewTraceLink`. Anything else needs an ADR.
- **Don't use `scrollIntoView` inside the trace waterfall.** It disrupts the scroll container; we use explicit `scrollTop` math. See `TraceTreeTab.tsx`.
- **Don't add `.dark` token overrides above the `:root` block they shadow.** Both have equal specificity, so source order wins. Putting `.dark` first means the trailing `:root` wins and dark mode breaks silently.
- **Don't add MSW handlers to the Node-side interceptor for tests.** Browser-mode is the path the React tree uses ([ADR-0003](./docs/adr/0003-msw-browser-only.md)).
- **Don't write WHAT a piece of code does in a comment.** Comment only when WHY isn't obvious from the code. Two-line max. No change-log comments.
- **Don't reach into `window.history` directly.** Use `useShallowSearchParams` so subscribers stay in sync.

## Feedback widget

`src/features/feedback/` implements an in-app feedback overlay that captures a screenshot via `html2canvas-pro` and files a GitHub issue. The API route (`/api/feedback`) commits the screenshot image to the repo and creates the issue. In dev without `FEEDBACK_GITHUB_TOKEN`, the route returns a mock issue URL so the UI flow works locally.

## Documentation map

- [docs/README.md](./docs/README.md) — start here
- [docs/glossary.md](./docs/glossary.md) — domain vocabulary
- [docs/adr/](./docs/adr/) — architecture decisions and their *why*
- [docs/features/](./docs/features/) — per-feature specs (e.g. [tracing.md](./docs/features/tracing.md))
- [docs/backend-contracts/](./docs/backend-contracts/) — API contracts with the backend
- [docs/design/](./docs/design/) — design references and runnable prototypes
- [docs/archive/](./docs/archive/) — historical phase-gate reports; not authoritative
