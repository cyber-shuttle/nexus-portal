# System Roles Consumer — PC0 Gate Report

**Spec:** `airavata-custos/docs/portal/2026-05-24-nexus-portal-system-roles-consumer.md`
**Backend contract:** `airavata-custos/docs/architecture/2026-05-24-system-roles.md` §5.4, §5.6
**Phase:** PC0 — Session shape + NextAuth jwt callback
**Date:** 2026-05-24

## Scope

Wires the `systemRole` axis from the core API's `GET /me/system-role` endpoint
into the portal's NextAuth session. On every initial sign-in the jwt callback
fetches the user's system role from the core API, stores it on the JWT, and
exposes it on the session. The fetch is fail-closed: any network error,
non-2xx status, malformed body, or timeout drives `systemRole` to `null` AND
zeroes the allocation scope arrays. No IdP-claim fallback exists; the v1
attack surface (trust an IdP claim if the DB is down) is closed by
construction.

## Files modified

| Path | Change |
|---|---|
| `src/types/next-auth.d.ts` | Adds `systemRole?: SystemRole \| null` to both `Session` and `JWT` augmentations. `SystemRole` is a local string-literal union (currently `"admin"` only) — future tiers extend the union without breaking existing readers. |
| `src/shared/auth/callbacks.ts` | `CallbackOptions` gains a required `coreApiBaseUrl: string` and an optional `fetchSystemRoleImpl` test hook. The jwt callback, after stamping per-provider state, calls `fetchSystemRoleFn(token.personId, coreApiBaseUrl)` when `user` is truthy. Success copies `result.role` to `token.systemRole`. Failure stamps `null`, logs a single `console.warn`, and zeroes `myPiAllocations` / `myPiProjects` / `myMemberProjects` / `assignedAllocations`. When `token.personId` is missing the fetch is skipped and `systemRole` defaults to `null`. The session callback copies `token.systemRole ?? null` onto `session.systemRole`. |
| `src/shared/auth/auth.ts` | Passes `coreApiBaseUrl: serverEnv.CORE_API_BASE_URL` into `buildAuthCallbacks`. |
| `src/shared/auth/__tests__/auth-callbacks.test.ts` | Existing `buildAuthCallbacks` call sites updated with the new `coreApiBaseUrl` + `fetchSystemRoleImpl` mock. Adds two new describe blocks covering the system-role success / null / failure / personId-missing / refresh paths (5 jwt tests) and the session-callback propagation (2 tests). |

## Files created

| Path | Purpose |
|---|---|
| `src/shared/auth/systemRole.ts` | Pure helper that calls `GET ${baseUrl}/me/system-role` with the `X-Custos-User-Id` header, a 5s `AbortSignal.timeout`, and zod-validates the response body against `{role: "admin" \| null}`. Throws on any failure (network, non-2xx, non-JSON body, contract violation, timeout) so the caller owns the fail-closed translation. `import "server-only"` prevents accidental client bundling. |
| `src/shared/auth/__tests__/systemRole.test.ts` | 12 unit tests covering success (admin / null), header + URL composition, every failure mode (401, 503, 5xx, generic 4xx, non-JSON body, contract violation on bad role value / wrong type / missing key, network rejection, timeout/abort). |

## Gate results

| Check | Result |
|---|---|
| `pnpm typecheck` | exit 0 |
| `pnpm lint` | exit 0, 430 files checked, 0 findings |
| `pnpm test` | 60 files / **448 tests passed** (was 428; +20) |
| `pnpm build` | exit 0, 27 routes — every route byte-identical to baseline (`/sign-in` 2.35 kB, shared 103 kB, etc.). Zero bundle delta. |
| Token-leak grep (`grep -rE "systemRole" src/ \| grep -v "use client\|__tests__\|types/next-auth"`) | Only `src/shared/auth/callbacks.ts` and `src/shared/auth/systemRole.ts` — both server-side. No client surface. |
| Manual `pnpm dev` smoke | Sign-in via the credentials FAB completes. Session payload: `provider: "credentials"`, `systemRole: null`. See "Drift" below — the warn does not fire on the credentials path because the existing dev provider does not stamp `personId` on the returned User, so the defensive `if (!token.personId)` branch short-circuits the fetch. The session-level state (null role) is still correct fail-closed behavior. |

`CORE_API_BASE_URL` resolves to `http://localhost:8080` in the test setup
(reading from `.env.local`, which mirrors the `serverEnv` default in
`src/lib/env.ts:10`). Tests inject `"http://core.test"` through the
`coreApiBaseUrl` option, so the production helper's URL composition is
exercised against a controlled host.

## Tests added

**Unit — `systemRole` (12):**

- `{role: "admin"}` on 200 returns `{role: "admin"}`
- `{role: null}` on 200 returns `{role: null}`
- sends `X-Custos-User-Id`, GET, with an abort signal, against `${baseUrl}/me/system-role`
- throws with the status code on 401, 503, 500, 418
- throws when the body is not JSON
- throws when role is `"superuser"` (unknown literal)
- throws when role is `42` (wrong type)
- throws when role is omitted on a 200 response
- throws with the underlying message on a fetch rejection
- throws with the underlying message on a `TimeoutError` abort

**Unit — auth-callbacks system role (7):**

- `fetchSystemRole` is called with `token.personId` and the configured base URL on initial sign-in; success stamps `token.systemRole`
- explicit `{role: null}` from the API stamps `null` without zeroing the allocation arrays
- a fetch rejection drives `systemRole` to `null`, zeroes all four allocation arrays, and emits exactly one `console.warn` containing the prefix `system-role fetch failed`
- when `token.personId` is missing, the fetch is skipped and `systemRole` defaults to `null`
- on a session refresh (`trigger: "update"`, `user` undefined), `fetchSystemRole` is NOT called and a pre-existing `token.systemRole` is preserved
- the session callback copies `token.systemRole` onto `session.systemRole`
- a missing `token.systemRole` is normalised to `null` on the session shape

## Drift from the brief

- **`buildAuthCallbacks` gained two options instead of one.** The brief
  suggested calling `fetchSystemRole(token.personId, serverEnv.CORE_API_BASE_URL)`
  directly inside the callback. The existing `buildAuthCallbacks` already takes
  configuration through an options object (`allowedEmails`, `oidcEnabled`)
  rather than reading `serverEnv` inline — to stay consistent with that pattern
  and to give tests a hook that does not require monkey-patching
  `globalThis.fetch`, I added `coreApiBaseUrl: string` and an optional
  `fetchSystemRoleImpl?: (...) => Promise<SystemRoleResponse>`. Production code
  in `auth.ts` passes the real `serverEnv.CORE_API_BASE_URL`; the optional
  override defaults to the real fetcher. Tests inject a `vi.fn()` mock.

- **Session callback lives in `callbacks.ts`, not a separate `session.ts`.**
  The brief sketched a `src/shared/auth/session.ts` file. The existing repo
  has the `session` callback inline inside `buildAuthCallbacks`, alongside
  `jwt` and `signIn`. I added the `session.systemRole = token.systemRole ?? null`
  line where the existing pattern lives rather than introducing a new file
  for a one-liner.

- **Manual dev smoke: `console.warn` does not fire on the credentials path.**
  The credentials provider in `src/shared/auth/auth.ts` returns a User with
  `id: email` but no `personId` field. The jwt callback's credentials branch
  stamps `token.personId = user.personId`, leaving `token.personId` undefined.
  The defensive `if (!token.personId)` gate then short-circuits and stamps
  `systemRole: null` without calling `fetchSystemRole`. The session-level
  outcome (null role, fail-closed) is unchanged, but the brief's expectation
  that the warn would fire in dev presumed the credentials path stamps
  `personId`. It does not, and PC2 is the place to align dev personas with
  the production user shape. For the OIDC path (the production flow), the
  callback sets `token.personId = user.email`, the fetch runs against
  `http://localhost:8080/me/system-role`, returns 404, throws, and the warn
  + zeroed-scopes branch fires as designed.

## Surprises

- **NextAuth `User.personId` is shape-only.** The credentials authorize()
  return type is wide enough to include the augmentation fields, but nothing
  enforces that any of them are actually set — the existing tests passed a
  `personId` explicitly in the fixture, hiding the gap in the dev wiring.
  The fail-closed branch in this PC0 work happens to mask this gap (null role
  on missing personId is the correct security posture), but PC2 / the dev
  persona alignment should set `personId` so the dev flow exercises the real
  fetch path against a real or mocked core API.
- **The Custos core's `GET /me/system-role` lives at the mux root**, not
  under `/api/v1`. The portal's existing `/api/v1/[...path]` proxy is a
  portal-only convention; the core Go server registers routes directly on
  its mux. Confirmed by `airavata-custos/internal/server/server.go:151` and
  by the 404-text-not-found shape of an unimplemented route on
  `http://localhost:8080/me/system-role`.
- **zod v4's `safeParse` error message** includes the full Zod error
  object in `error.message` rather than a short string. Test assertions use
  a substring match (`/violates contract/`) rather than equality so the test
  is robust to future Zod formatting changes.
- **Bundle delta is exactly zero across all 27 routes.** `systemRole.ts` is
  marked `server-only` and pulled in only from `callbacks.ts`, which is
  already on the server side via `auth.ts`. Nothing leaks into a client
  chunk; the build output diff is byte-identical to the pre-change baseline.

## Out of scope (PC1 / PC2 carry-over)

- CASL unified `defineAbility(session)` entry point and the `applyAllocationRules`
  refactor — PC1.
- Sidebar nav rendering both "My allocations" and "Site administration"
  sections — PC1.
- `AbilityProvider` consumption of `session.systemRole` — PC1.
- Updating `devPersonas` so the credentials dev flow exercises the
  `/me/system-role` fetch end-to-end — PC2.
- Updating `docs/backend-contracts/auth.md` to reflect the DB-authoritative
  flow with no claim fallback — PC2.
- The "backend unreachable" banner in the UI — PC1 (the session-level state
  is in place; the banner reads `session.systemRole === null` and decides
  whether to render).
- Playwright e2e covering admin / PI / admin+PI dual-section rendering — PC2.
