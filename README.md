# Nexus Portal

Web portal for **Apache Custos / Nexus** — allocation management, identity, signer operations, and admin tooling for HPC sites.

## Stack

Next.js 15 (App Router) · TypeScript · Tailwind + shadcn/ui · NextAuth v5 · TanStack Query · React Hook Form + Zod · CASL · MSW · Playwright + Vitest · Biome · pnpm.

## Getting started

```bash
pnpm install
cp .env.example .env.local
pnpm dev
```

Defaults boot the portal with dev-mode auth and MSW-mocked APIs, so no backend is required to develop UI. See [CLAUDE.md](./CLAUDE.md) for the full command list, env modes, and architecture overview.

## Documentation

- [`CLAUDE.md`](./CLAUDE.md) — architecture, conventions, and dev workflow (also the entry point for AI assistants)
- [`docs/README.md`](./docs/README.md) — documentation index
- [`docs/glossary.md`](./docs/glossary.md) — domain vocabulary
- [`docs/adr/`](./docs/adr/) — architecture decision records
- [`docs/features/`](./docs/features/) — feature specs (e.g. [`tracing.md`](./docs/features/tracing.md))
- [`docs/backend-contracts/`](./docs/backend-contracts/) — API contracts between the portal and Custos backends

## Quality bar

Every commit must leave `pnpm build` and `pnpm dev` green. The composite `pnpm verify` script runs lint + typecheck + Vitest + build and is the gate before opening a PR.
