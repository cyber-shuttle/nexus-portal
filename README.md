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

## Git

Local-only repo. **Do not push to a remote.**
