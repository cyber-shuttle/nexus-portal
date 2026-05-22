# Backend contract — AMIE packet console

Status: **Phase 6 — MSW handlers implement this verbatim.** Once the
AMIE-Processor exposes the HTTP surface below, the portal flips with one env
flag and the MSW worker steps aside.

Source of truth for the packet / event / audit shape:
`airavata-custos/connectors/ACCESS/AMIE-Processor/model/{packet,event,audit}.go`
plus the handlers under `handler/`.

## Resource shapes

### Packet
| Field | Type | Notes |
|---|---|---|
| `id` | string | Portal-generated row id (e.g. `pkt-0001`). Stable across retries. |
| `amie_id` | string | The AMIE-supplied packet ID. Numeric on the wire today; MSW serializes as a string for forward-compat with future opaque IDs. |
| `type` | string | snake_case (`request_project_create`, `request_account_inactivate`, `inform_transaction_complete`, etc.). Closed set in `features/amie/types.ts::PACKET_TYPES`. |
| `status` | enum | `NEW \| DECODED \| PROCESSED \| FAILED`. Mirrors `model/packet.go::PacketStatus`. |
| `source` | string | Today always `"access"`. Reserved for future site connectors. |
| `raw_json` | string? | Raw AMIE payload as received. May be omitted on list responses. |
| `decoded_payload` | object? | Decoded packet body (handler-specific). |
| `received_at` | RFC3339 | When the connector pulled it from the AMIE inbox. |
| `decoded_at` | RFC3339? | When the decode step completed. |
| `processed_at` | RFC3339? | When the handler finished successfully. |
| `updated_at` | RFC3339 | Last state-change timestamp. |
| `retries` | int | Number of manual + automatic retry attempts. |
| `last_error` | string? | Truncated last-failure message (FAILED packets only). |
| `linked_entity` | LinkedEntityRef? | Set once a handler links the packet to a domain entity. |

### LinkedEntityRef
| Field | Type | Notes |
|---|---|---|
| `type` | enum | `project \| account \| person \| user_merge`. |
| `id` | string | Foreign key into the core domain (project_id, user_id, etc.). |
| `display_id` | string? | Human-friendly id (e.g. originated_id `BIO130001`). |

### PacketEvent
Append-only timeline per packet. Mirrors `model/event.go::ProcessingEvent` with
manual-action types overlaid.

| Field | Type | Notes |
|---|---|---|
| `id` | string | Stable. |
| `packet_id` | string | FK. |
| `event_type` | enum | `RECEIVED \| DECODED \| HANDLED \| RETRY_SCHEDULED \| RETRY \| FAILED \| MANUAL_RESOLVE \| MANUAL_LINK`. |
| `actor` | string | `amie-worker`, an admin email, or `system`. |
| `status` | enum | `SUCCEEDED \| FAILED \| RUNNING`. |
| `message` | string? | Human summary or error excerpt. |
| `timestamp` | RFC3339 | |
| `duration_ms` | int? | Wall-clock duration of the step. |

### PacketAudit
Persistent record of every manual operation. Mirrors `model/audit.go::AuditLog`.
Today MSW does **not** surface this in the API; instead, manual events appear
as `MANUAL_*` entries in the timeline. The connector should expose a
`/amie/packets/{id}/audit` endpoint once the audit table backs persistent rows.

### Reply
Outgoing `inform_*` packets the connector sends back to ACCESS.

| Field | Type | Notes |
|---|---|---|
| `id` | string | Stable. |
| `amie_id` | string | AMIE-assigned. |
| `type` | string | `inform_project_create`, `inform_account_create`, `inform_transaction_complete`, etc. |
| `status` | enum | `PENDING \| SENT \| ACKED \| FAILED`. |
| `in_reply_to_packet_id` | string? | The originating inbound packet. |
| `created_at` | RFC3339 | |
| `sent_at` | RFC3339? | First attempt timestamp. |
| `acked_at` | RFC3339? | When ACCESS acknowledged. |
| `retries` | int | |
| `last_error` | string? | |

## Endpoint table

| Verb | Path | Request | Response | Notes |
|---|---|---|---|---|
| GET | `/amie/packets` | query: `status` (csv), `type` (csv), `source`, `q`, `from`, `to`, `limit`, `offset` | `{ packets: Packet[], total, limit, offset }` | Sort: `received_at` desc. `q` matches `amie_id`, packet `id`, or `linked_entity.id`. |
| GET | `/amie/packets/{id}` | — | `Packet` | 404 if unknown. |
| GET | `/amie/packets/{id}/events` | — | `PacketEvent[]` | Sort: `timestamp` asc. |
| POST | `/amie/packets/{id}/retry` | — | `{ queued: true, packet: Packet }` | Increments `retries`. If status was `FAILED`, flips to `DECODED` so the worker reattempts. Appends a `RETRY_SCHEDULED` event. |
| POST | `/amie/packets/{id}/resolve` | `{ reason: string (min 3) }` | `Packet` | Sets status `PROCESSED`, clears `last_error`, appends `MANUAL_RESOLVE` event. 400 if reason missing. |
| GET | `/amie/replies` | query: `status` (csv), `from`, `to`, `limit`, `offset` | `{ replies: Reply[], total, limit, offset }` | Sort: `created_at` desc. |
| POST | `/amie/replies/{id}/retry` | — | `{ queued: true }` | Increments `retries`. If `FAILED`, flips to `PENDING`. |
| GET | `/amie/unmapped` | query: `limit`, `offset` | `{ packets: Packet[], total, limit, offset }` | Filter: `status=DECODED AND linked_entity IS NULL`. |
| POST | `/amie/unmapped/{id}/link` | `{ entity_type, entity_id }` | `Packet` | Sets `linked_entity`, flips status to `PROCESSED`, appends `MANUAL_LINK` event. Spec §10.3 originally listed `entityType/entityId` (camelCase); the contract here uses snake_case to match the rest of the API surface. |
| GET | `/amie/stats` | query: `window` (e.g. `30d`) | `{ byDay: PacketStatBucket[] }` | One row per `(date, status, type)`. |

## Validation + status codes

- All POST bodies are Zod-validated by the portal client and by the MSW
  handler before mutation. Invalid bodies return **400** with
  `{ error: "invalid_request", issues: ... }`.
- Missing resources return **404** with `{ error: "not_found" }`.
- Domain conflicts (e.g. trying to link an already-linked packet) return
  **409**.

## Auth model

- Admin-only. The proxy at `src/app/api/v1/[...path]/route.ts` already routes
  `/amie/*` to `AMIE_API_BASE_URL`; the AMIE-Processor side must enforce that
  the bearer token's role includes `admin` (or a `manage AmiePacket` CASL
  equivalent on a future role).
- The portal CASL rule today grants `manage all` to admins, which transitively
  covers AmiePacket. Phase 7 may carve out a dedicated `amie:read` role for
  read-only ops console viewers.

## Reconciliation semantics

When the connector calls `POST /amie/unmapped/{id}/link`, the backend MUST:

1. Persist a foreign-key reference from the packet row to the target entity.
   For `entity_type=project`, this is `packets.linked_project_id`. For
   `entity_type=account`, `packets.linked_account_id`. (Schema TBD with the
   connector team — current MSW just stores `linked_entity` as a JSON column.)
2. Append an `AuditLog` row with `action=MANUAL_LINK`,
   `entity_type=<type>`, `entity_id=<id>`, `summary=<reason>`.
3. Flip the packet status to `PROCESSED` and set `processed_at=now()`.

For `POST /amie/packets/{id}/resolve`, the audit row is
`action=MANUAL_RESOLVE` with the supplied reason as the summary.

## Open questions

1. **Retry semantics.** Does a retry create a *new* `ProcessingEvent` row
   (preserving the chain), or does it reset the existing one? The portal
   currently expects new event rows. Confirm with the AMIE team.
2. **Status filter combinatorics.** The portal sends comma-separated lists
   (`status=FAILED,DECODED`). The Go side currently filters single-valued —
   migrate to multi-valued or document the single-valued limit.
3. **Stats window granularity.** Today `window` is `30d|7d|24h`; we may
   want `?from=&to=` for arbitrary ranges. Decide when the dashboard
   starts asking for non-default windows.
4. **`/amie/packets/{id}/audit`** — the audit table is real but not yet
   exposed. The Timeline tab synthesizes manual events from `MANUAL_*`
   event rows; if/when audit is exposed, surface both feeds side-by-side
   in the drawer.
5. **Reply retry idempotency.** What guarantees does the connector make
   when an admin clicks Retry on a `SENT` reply? MSW today is a no-op for
   non-FAILED replies; the real backend may reject 409.
