# Backend contract — proposals

Placeholder. Detailed shape lands in Phase 4 when the proposal wizard is built.

Until then the portal expects:

- `POST /proposals` — create draft / submit
- `GET /proposals` — list (admin queue + own)
- `GET /proposals/{id}` — detail
- `POST /proposals/{id}/approve`
- `POST /proposals/{id}/deny`

TBD: field-level shape (PI, project metadata, requested SUs per resource, end
date, justification, attachments). The MSW handlers stay empty until Phase 4
specifies the contract.
