# Documentation

Start here if you're new to the codebase.

| Looking for | Read |
| --- | --- |
| Project overview, how to run the app | [`../README.md`](../README.md) |
| Architecture, conventions, dev workflow (also entry point for AI assistants) | [`../CLAUDE.md`](../CLAUDE.md) |
| Domain vocabulary (AMIE, COmanage, allocation, packet, co_pi, …) | [`glossary.md`](./glossary.md) |
| Why we chose what we chose | [`adr/`](./adr/) |
| Feature-specific specs | [`features/`](./features/) |
| API contracts with the backend | [`backend-contracts/`](./backend-contracts/) |
| Design references | [`design/`](./design/) |
| Release / test reports | [`releases/`](./releases/) |

## Layout

```
docs/
  README.md              ← you are here
  glossary.md            ← domain vocabulary

  adr/                   ← architecture decision records
  features/              ← per-feature specs
  backend-contracts/     ← API contracts (one file per resource)
  design/                ← design handoff references
  releases/              ← release / test reports
```

## Conventions

- Feature specs in `features/` are short, durable, and describe how the feature works *today*. They are not change logs.
- ADRs in `adr/` capture the *why* behind decisions. New ADRs are numbered sequentially. Existing ADRs are not edited after they're marked Accepted — supersede them with a new one if a decision changes.
- Backend contracts in `backend-contracts/` are the negotiated API surface between this portal and the Custos backend. Each file mirrors one resource.
