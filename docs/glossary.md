# Glossary

Domain vocabulary used throughout the portal. Skim this once before reading feature specs or making changes — most terms are HPC-domain-specific and have meanings that aren't obvious from the names alone.

## Projects & people

**Apache Custos** — The backend platform this portal is a UI for. Provides identity, group, allocation, and policy services for HPC sites.

**Nexus** — The portal product name. This repo (`nexus-portal`) is the web UI; the backend lives in `airavata-custos`.

**PI** (Principal Investigator) — The lead researcher on a project. Owns the project, can submit allocation proposals, and manages membership.

**co_pi** — A co-investigator on a project. Can act on the PI's behalf for most operations but cannot transfer ownership.

**allocation_manager** — A role that can manage compute allocations across one or more projects without being a PI. Often a research-software engineer or admin assistant.

**Site administrator** — Holds the `admin` system role. Sees the entire `/admin/*` area, all sites' data, and can manage clusters, audit logs, and traces.

## Identity & access

**OIDC** — OpenID Connect. The production sign-in path uses a Keycloak IdP. Dev mode bypasses this with a credentials provider.

**CASL** — The permissions library used here. Roles map to abilities (`can('read', 'Trace')`); UI gates use the `<Can>` component or `useAbility()` hook. Don't gate on raw role strings.

**Persona** — In dev mode, the sign-in dropdown lets you pick a persona (`researcher`, `pi`, `admin`) so you can exercise different ability sets without switching real accounts.

**Email allowlist** — In OIDC mode, the `NEXUS_ALLOWED_EMAILS` env var gates sign-in to a predetermined list of stakeholders. Used during early-access rollout.

## Resource model

**Project** — Top-level container. Has members (PI + co-PIs + regular members), proposals, allocations, and change requests.

**Allocation** — A grant of compute resources on a specific cluster. Has a quota, a billing window, and usage telemetry. One project may hold multiple allocations across clusters.

**Cluster** — A specific HPC site / machine the portal can provision against. Each cluster has its own enablement state and supports its own connector mix.

**Proposal** — A request for an allocation. Goes through a review workflow before becoming an allocation.

**Change request** — A change to an existing allocation (extension, transfer, additional resources). Has its own approval workflow.

## Connectors

**AMIE** — The protocol HPC sites use to exchange account-provisioning and usage telemetry with allocation managers. This portal includes an AMIE packet inbox (`/admin/amie`) for inspecting in-flight packets.

**Packet** — A single AMIE message envelope (e.g. `request_account_create`, `notify_user_modify`). Has a transaction context and one or more events.

**COmanage** — A group-and-identity-management service hosted on CILogon. The portal can pull POSIX attrs from COmanage via LDAP + REST.

**Slurm** — The workload manager running on most target clusters. Source for account / association / usage data.

## Tracing

**Trace** — A correlated set of audit-log rows representing one end-to-end multi-step flow (e.g. one AMIE provisioning request). Has a `trace_id`, a root action, a source, and a span tree.

**Span** — One step inside a trace. Has a `span_id`, a parent (or null for roots), an action name, a status, and attributes. Spans build a tree via `parent_span_id`.

**Root action** — The name of the top-level span in a trace. What kicked the flow off.

**Source** — Which subsystem produced the trace (`amie`, `comanage`, `slurm`, `http`, `core`).

**Status** — Integer encoding for a span's outcome: `0` = ok, `1` = error, `null` = no status (in-flight or no-status-yet). The UI overlays run-state flags (`running`, `notRun`, `orphan`) on top to derive the visible tone.

**Orphan span** — A span whose `parent_span_id` doesn't resolve to a span inside the trace. Surfaces with a hollow status ring and an "(orphan)" tag.

**Retry trace** — A retry of a failed trace produces a *new* trace linked back to the original. Retry roots are lifted to top-level siblings inside the tree so they stay legible.

## Signer

**Signer service** — A separate backend that issues short-lived certificates for cluster access. Reached via `SIGNER_API_BASE_URL` through the `/api/v1/signer/*` and `/api/v1/certificates/*` proxy paths.
