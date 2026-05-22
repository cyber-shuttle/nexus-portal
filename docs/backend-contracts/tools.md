# Backend contract — tools

Portal-only utility endpoints. Mocked by MSW (`src/mocks/handlers/tools.ts`)
until the backend implements them.

## POST /tools/credit-transfer

Atomically move SUs from one compute allocation to another. The backend must
do this in a single transaction so both sides update or neither does.

### Request

```json
{
  "source_allocation_id": "alloc-001",
  "destination_allocation_id": "alloc-007",
  "compute_allocation_resource_id": "alloc-001-res-2",
  "su_amount": 12000,
  "transferred_by": "pi@nexus.local",
  "note": "Final push for the X-ray crystallography pipeline."
}
```

### Validation rules

| Code | Status | Condition |
|---|---|---|
| `invalid_request` | 400 | Payload fails schema validation. |
| `source_and_destination_must_differ` | 400 | Same allocation on both sides. |
| `allocation_not_found` | 404 | Either id not in core. |
| `allocations_must_be_active` | 409 | Either side has `status != ACTIVE`. |
| `insufficient_balance` | 409 | `su_amount > remaining(source)`. Response includes `available` and `requested`. |

### Success response (201)

```json
{
  "transfer_id": "xfer-abc12345",
  "source_allocation_id": "alloc-001",
  "destination_allocation_id": "alloc-007",
  "compute_allocation_resource_id": "alloc-001-res-2",
  "su_amount": 12000,
  "transferred_by": "pi@nexus.local",
  "transferred_at": "2026-05-22T19:04:00Z",
  "source_balance_after": 38000,
  "destination_balance_after": 62000
}
```

### Side effects the backend must produce

1. Decrement `source.initial_su_amount` by `su_amount`.
2. Increment `destination.initial_su_amount` by `su_amount`.
3. Append a `ComputeAllocationDiff` row on the source with `diff_type =
   CREDIT_TRANSFER_OUT`.
4. Append a `ComputeAllocationDiff` row on the destination with `diff_type =
   CREDIT_TRANSFER_IN`.
5. Both diff rows must reference the same `transfer_id` so the audit timeline
   can correlate them. (The portal does this via the `description` field
   today; a real `transfer_id` FK would be cleaner.)

### Authorization

The caller must have `manage Allocation` on both endpoints. The portal's
default is to allow only PIs of both allocations; an `allocation_manager`
should be able to override across allocations they manage.
