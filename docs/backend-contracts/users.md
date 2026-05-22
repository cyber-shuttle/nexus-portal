# Backend contract — users / projects (portal extensions)

Portal-only endpoints powering PI rollups. Both are convenience views the core
should land next to the existing `/users/{id}` and `/projects/{id}` routes.

## GET /users/{id}/projects-as-pi

Projects where the given user is the PI (`projects.project_pi_id = id`).

Request — path param `id` only.

Response — array of `Project` rows (snake_case JSON; matches
`pkg/models/allocation.go: Project`).

```json
[
  {
    "id": "project-001",
    "originated_id": "BIO130001",
    "title": "Research Project 1",
    "origination": "ACCESS",
    "project_pi_id": "pi@nexus.local",
    "status": "ACTIVE",
    "created_time": "2025-12-01T00:00:00Z"
  }
]
```

## GET /projects/{id}/compute-allocations

All allocations under the given project. Used by PI home rollup and (in
Phase 3+) by the proposal/credit flows.

Request — path param `id`.

Response — array of `ComputeAllocation` rows (snake_case JSON).

## GET /users?q={query}

Phase 3 add: free-text autocomplete for the "Add member" UX. Searches by
name and email. Returns at most 20 rows.

Request:

- `q` — required, free text (case-insensitive contains).
- `limit` — optional, default 20.

Response — array of `User` rows.

```json
[
  { "id": "user-001", "first_name": "Riya", "last_name": "Researcher",
    "email": "researcher@nexus.local", "organization_id": "org-001",
    "status": "ACTIVE" }
]
```
