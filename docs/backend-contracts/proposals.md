# Backend contract — proposals

Portal-side allocation proposal flow. Backend has no model yet — these
endpoints are mocked by MSW (`src/mocks/handlers/proposals.ts`) and the
shape below is the contract the backend should implement.

## Resource shape

```ts
type ProposalStatus =
  | "DRAFT"
  | "SUBMITTED"
  | "UNDER_REVIEW"
  | "APPROVED"
  | "DENIED"
  | "WITHDRAWN";

type ProposalResourceRequest = {
  resource_id: string;
  resource_name: string;
  resource_type: string;          // "cpu" | "gpu" | …
  requested_su_amount: number;
};

type ProposalChildAllocationRequest = {
  project_id: string;
  project_title: string;
  su_split_percent: number;       // 0..100, sum across children must equal 100
};

type ProposalDecision = {
  decided_by: string;             // approver user id
  decided_at: string;             // RFC3339
  decision_note?: string;
};

type Proposal = {
  id: string;
  project_id: string;
  project_title: string;
  requester_id: string;
  title: string;                   // 3..160 chars
  abstract: string;                // 40..1200 chars
  justification: string;           // 500..2000 chars
  start_date: string;              // RFC3339
  end_date: string;                // RFC3339
  resources: ProposalResourceRequest[];
  cascade_to_sub_projects: boolean;
  child_allocations: ProposalChildAllocationRequest[];
  status: ProposalStatus;
  decision?: ProposalDecision;
  created_at: string;
  updated_at: string;
};
```

## Endpoints

### GET /proposals

Query params: `status` (comma-separated enum), `project_id`, `requester_id`,
`q` (free text match against title or project title), `limit`, `offset`.

Returns `Proposal[]`. Default sort: `created_at DESC`.

### GET /proposals/{id}

Returns the full `Proposal` row. 404 if missing.

### POST /proposals

Body matches `createProposalPayloadSchema` in
`src/features/proposals/schemas.ts`. Server stamps `id`, `created_at`,
`updated_at`. `status` defaults to `SUBMITTED` (the wizard can pass `DRAFT`).

Returns the created `Proposal` with `201`.

### PUT /proposals/{id}

Partial patch of any payload field. Server stamps `updated_at`. Returns the
updated row.

### POST /proposals/{id}/approve, POST /proposals/{id}/deny

```json
{
  "decided_by": "admin@nexus.local",
  "decision_note": "Aligned with quarterly capacity plan."
}
```

Server flips `status` to `APPROVED` or `DENIED`, fills `decision`, stamps
`updated_at`. Returns the updated row.

### POST /proposals/{id}/withdraw

```json
{ "requester_id": "pi@nexus.local" }
```

Only the requester (or admin) may withdraw. Server returns 403 otherwise.
Status flips to `WITHDRAWN`.

## Cascade-to-sub-projects semantics

When `cascade_to_sub_projects` is `true`, the backend should fan out child
allocations on approval — one per `child_allocations` entry, with SU amounts
sliced by `su_split_percent`. The portal validates the split sums to 100% in
the wizard before submission.

### Synthetic sub-projects (portal-only stop-gap)

The current `Project` resource has no `parent_project_id` / `child_projects`
relation, so the wizard cannot enumerate real sub-projects. As a stop-gap the
portal generates two placeholder entries per parent — `${parent_id}-sub-a` and
`${parent_id}-sub-b` — and surfaces them in the cascade step so the UX is
exercised end-to-end. The backend must replace this with the real hierarchy
once `parent_project_id` ships; the portal then drops the synthetic IDs and
reads the child set from the project record itself. Until then, an approval
with a synthetic `child_allocations` entry is **not** safe to fan out — the
backend should reject `cascade_to_sub_projects=true` with `unknown_subproject`
when a referenced child does not exist.
