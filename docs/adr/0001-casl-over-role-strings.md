# ADR-0001: CASL abilities, not role-string checks

**Status:** Accepted
**Date:** 2026-05

## Context

The portal has two orthogonal permission axes:

- A portal axis: `guest | user | pi | co_pi | allocation_manager`
- A system axis: `admin`

Some pages are gated by membership/role (you must be a PI on a project to submit a proposal for it), others by system role (only `admin` sees `/admin/*`), and many by a combination ("PIs can request extensions, but only on allocations they own").

The simplest approach — `if (session.role === 'admin') { … }` checks scattered through components — collapses badly as soon as a third axis appears, and it tempts contributors to copy a hardcoded role check into a new file rather than think about what the *capability* actually is.

## Decision

All permission checks go through CASL. Abilities are derived from the session at provider boot (`src/shared/casl/abilities.ts`), and UI gates use either the `<Can>` component or the `useAbility()` hook.

Subjects are strings (`'Trace'`, `'Project'`, `'Allocation'`, …) and actions are verbs (`'read'`, `'update'`, `'retry'`, …). New permissions add a rule in `applyAdminRules` / `applyPortalRules` rather than a new role string anywhere.

## Consequences

- The cost of adding a new system role is one place: the rule file. Every callsite already says what it actually needs (`can('retry', 'Trace')`), so changing who has that ability doesn't touch any component.
- The sidebar (`portalNav`) participates in the same model — items declare an `ability` and the layout filters them. A user who can't read traces never sees the nav entry.
- Don't reach into `session.role` for UI gating, even when it would be shorter. The grep target for review is exactly this pattern: a role-string compare in a component file.
- Backend authorization is the source of truth. CASL on the frontend is for *affordances* (don't show a button the user can't use), not security. Every protected endpoint must validate authorization server-side too.
