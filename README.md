# Nexus Portal

Web portal for **Apache Custos / Nexus** — allocation management, identity, signer operations, and admin tooling for HPC sites.

## Status

Empty scaffold. To be built per the design spec at:

```
../airavata-custos/docs/portal/2026-05-22-nexus-portal-design.md
```

Backend lives at `../airavata-custos/` (sibling directory). UX reference is the Figma file linked from the spec. Inspiration project (read-only) lives at `../../github/sam-queries`.

## Conventions

- Next.js 15 (App Router) · TypeScript · Tailwind + shadcn/ui · NextAuth v5 · TanStack Query · React Hook Form + Zod · CASL · MSW · Playwright + Vitest · Biome · pnpm
- Feature-based folder layout that mirrors the `core/` and `connectors/` capability grouping in `airavata-custos`
- Every commit must leave `pnpm build` and `pnpm dev` green

## /admin/traces

Admin-only request flow viewer for Custos. Lists every captured trace, opens a side-drawer with Overview / Waterfall / Raw JSON / Linked entities tabs, and exposes a one-click Retry for failed flows. Spec: `../airavata-custos/docs/internal/portal/2026-06-03-tracing-admin-ui.md`; the backend contract mirror is at `docs/backend-contracts/traces.md`. Today the routes are served by MSW fixtures — flip to live by adding `traces*` and `audit-events` to `PORTAL_LIVE_ENDPOINTS`. Accessibility posture: axe-core clean across the list and drawer e2e suites, full keyboard navigation in the waterfall (arrow keys move selection, right opens the detail panel, left closes it). Per-phase gate reports live under `docs/tracing-ui-gates/phase-1.md` … `phase-6.md`; the end-of-goal hand-off Commit Plan lives at `docs/tracing-ui-gates/commit-plan.md`.

## Git

Local-only repo. **Do not push to a remote.**
