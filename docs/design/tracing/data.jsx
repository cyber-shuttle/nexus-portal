/* ============================================================
   Custos Admin Trace View — sample data
   Audit rows joined into trees by parent_span_id.
   ============================================================ */

const NOW = Date.parse('2026-06-04T14:23:10.000Z');

// helper: ISO from offset seconds before NOW
const t = (secAgo) => new Date(NOW - secAgo * 1000).toISOString();

/* -------------------------------------------------------------
   HERO TRACE — failed AMIE account provisioning (COmanage 404)
   14 spans. Failing leaf: ComanageProvisioningFailed.
   ------------------------------------------------------------- */
const HERO_SPANS = [
  { span_id: 's1_a3b1', parent_span_id: null, action: 'amie.process:request_account_create', source: 'amie',
    started_at: t(132), ended_at: t(120), status: 1, kind: 'span',
    summary: 'AMIE packet request_account_create failed during COmanage provisioning.',
    attributes: { 'amie.packet_id': 'pkt_a3b1c92d', 'amie.packet_type': 'request_account_create', 'amie.site': 'nexus-prod', 'entity.user_id': 'usr_4f2e1d6b' } },

  { span_id: 's2_1f2e', parent_span_id: 's1_a3b1', action: 'amie.handle:request_account_create', source: 'amie',
    started_at: t(131), ended_at: t(120), status: 1, kind: 'span',
    summary: 'Handler dispatched account-create steps; halted after COmanage failure.',
    attributes: { 'entity.user_id': 'usr_4f2e1d6b', 'amie.handler': 'AccountCreateHandler', 'amie.steps': '4' } },

  { span_id: 's3_validate', parent_span_id: 's2_1f2e', action: 'amie.validate:packet', source: 'amie',
    started_at: t(131), ended_at: t(131), status: 0, kind: 'event',
    summary: 'Packet schema validated. 0 errors.',
    attributes: { 'validate.schema': 'request_account_create.v3', 'validate.errors': '0' } },

  { span_id: 's4_create_person', parent_span_id: 's2_1f2e', action: 'CREATE_PERSON', source: 'amie',
    started_at: t(130), ended_at: t(122), status: 1, kind: 'span',
    summary: 'Create person step delegated to COmanage provisioning.',
    attributes: { 'person.id': 'pkt_a3b1c92d', 'person.email': 'alice@example.org', 'person.given': 'Alice', 'person.family': 'Nguyen' } },

  { span_id: 's5_comanage_start', parent_span_id: 's4_create_person', action: 'ComanageProvisioningStarted', source: 'comanage',
    started_at: t(129), ended_at: t(122), status: 1, kind: 'span',
    summary: 'COmanage provisioning event opened for co_person_id co_88213.',
    attributes: { 'comanage.co_id': '7', 'comanage.co_person_id': 'co_88213', 'comanage.email': 'alice@example.org', 'retry.target': 'true' } },

  { span_id: 's6_lookup', parent_span_id: 's5_comanage_start', action: 'comanage.lookup:co_person', source: 'comanage',
    started_at: t(129), ended_at: t(128), status: 0, kind: 'event',
    summary: 'Looked up existing CO person records. None matched; proceeding to create.',
    attributes: { 'comanage.co_id': '7', 'comanage.matched': '0', 'http.status_code': '200' } },

  { span_id: 's7_created', parent_span_id: 's5_comanage_start', action: 'ComanageCoPersonCreated', source: 'comanage',
    started_at: t(128), ended_at: t(126), status: 0, kind: 'event',
    summary: 'CO person record created in COmanage registry.',
    attributes: { 'comanage.co_person_id': 'co_88213', 'http.status_code': '201' } },

  { span_id: 's8_failed', parent_span_id: 's5_comanage_start', action: 'ComanageProvisioningFailed', source: 'comanage',
    started_at: t(124), ended_at: t(122), status: 1, kind: 'event',
    summary: 'COmanage REST API returned 404 looking up co_person_id=co_88213 during role enrollment. The CO person was created but the enrollment endpoint could not resolve it — likely an eventual-consistency gap in the COmanage registry.',
    status_message: 'ComanageProvisioningFailed: 404 Not Found',
    attributes: { 'comanage.co_id': '7', 'comanage.co_person_id': 'co_88213', 'comanage.email': 'alice@example.org', 'comanage.endpoint': '/co_person_roles.json', 'http.method': 'POST', 'http.status_code': '404', 'error.kind': 'ComanageProvisioningFailed' } },

  { span_id: 's9_enroll', parent_span_id: 's4_create_person', action: 'comanage.enroll:co_person', source: 'comanage',
    started_at: t(122), ended_at: null, status: null, kind: 'event', notRun: true,
    summary: 'Role enrollment not run — parent step failed.',
    attributes: { 'comanage.co_id': '7' } },

  { span_id: 's10_create_account', parent_span_id: 's2_1f2e', action: 'CREATE_ACCOUNT', source: 'amie',
    started_at: t(122), ended_at: null, status: null, kind: 'span', notRun: true,
    summary: 'Skipped — upstream CREATE_PERSON failed.',
    attributes: { 'account.resource': 'expanse', 'amie.skip_reason': 'parent_error' } },

  { span_id: 's11_slurm_map', parent_span_id: 's10_create_account', action: 'slurm.user.map', source: 'slurm',
    started_at: t(122), ended_at: null, status: null, kind: 'event', notRun: true,
    summary: 'Not run — parent step skipped.',
    attributes: { 'slurm.cluster': 'expanse', 'slurm.account': 'alloc_TG-CCR' } },

  { span_id: 's12_slurm_sync', parent_span_id: 's10_create_account', action: 'slurm.account.sync', source: 'slurm',
    started_at: t(122), ended_at: null, status: null, kind: 'event', notRun: true,
    summary: 'Not run — parent step skipped.',
    attributes: { 'slurm.cluster': 'expanse' } },

  { span_id: 's13_reply', parent_span_id: 's1_a3b1', action: 'amie.reply', source: 'amie',
    started_at: t(120), ended_at: null, status: null, kind: 'event', notRun: true,
    summary: 'Reply packet not sent — process ended in error.',
    attributes: { 'amie.reply_type': 'inform_transaction_complete' } },

  { span_id: 's14_persist', parent_span_id: 's1_a3b1', action: 'amie.audit:persist', source: 'core',
    started_at: t(120), ended_at: t(120), status: 0, kind: 'event',
    summary: 'Audit rows persisted for this trace.',
    attributes: { 'audit.rows': '14', 'audit.table': 'amie_audit_log' } },
];

/* -------------------------------------------------------------
   HEALTHY TRACE — http POST status, all ok (3 spans)
   ------------------------------------------------------------- */
const HEALTHY_HTTP_SPANS = [
  { span_id: 'h1', parent_span_id: null, action: 'http.POST /users/{id}/status', source: 'http',
    started_at: t(420), ended_at: t(419), status: 0, kind: 'span',
    summary: 'Update user status endpoint handled successfully.',
    attributes: { 'http.method': 'POST', 'http.route': '/users/{id}/status', 'http.status_code': '200', 'entity.user_id': 'usr_9c4a01ff' } },
  { span_id: 'h2', parent_span_id: 'h1', action: 'user.status.update', source: 'core',
    started_at: t(420), ended_at: t(419), status: 0, kind: 'event',
    summary: 'User status set to ACTIVE.',
    attributes: { 'user.status.from': 'PENDING', 'user.status.to': 'ACTIVE' } },
  { span_id: 'h3', parent_span_id: 'h1', action: 'audit.persist', source: 'core',
    started_at: t(419), ended_at: t(419), status: 0, kind: 'event',
    summary: 'Audit row written.',
    attributes: { 'audit.rows': '3' } },
];

/* -------------------------------------------------------------
   HEALTHY TRACE — amie project create, all ok (9 spans)
   ------------------------------------------------------------- */
const HEALTHY_PROJECT_SPANS = [
  { span_id: 'p1', parent_span_id: null, action: 'amie.process:request_project_create', source: 'amie',
    started_at: t(720), ended_at: t(710), status: 0, kind: 'span',
    summary: 'Project creation packet processed successfully.',
    attributes: { 'amie.packet_id': 'pkt_5d8e7b21', 'amie.packet_type': 'request_project_create', 'entity.project_id': 'prj_22f1a0' } },
  { span_id: 'p2', parent_span_id: 'p1', action: 'amie.handle:request_project_create', source: 'amie',
    started_at: t(719), ended_at: t(710), status: 0, kind: 'span',
    summary: 'Handler completed all project-create steps.',
    attributes: { 'amie.handler': 'ProjectCreateHandler' } },
  { span_id: 'p3', parent_span_id: 'p2', action: 'CREATE_PROJECT', source: 'amie',
    started_at: t(718), ended_at: t(715), status: 0, kind: 'span',
    summary: 'Project record created.',
    attributes: { 'project.id': 'prj_22f1a0', 'project.grant': 'TG-CCR250042' } },
  { span_id: 'p4', parent_span_id: 'p3', action: 'comanage.cou.create', source: 'comanage',
    started_at: t(718), ended_at: t(716), status: 0, kind: 'event',
    summary: 'COU (COmanage group) created for project.',
    attributes: { 'comanage.cou_id': 'cou_412', 'http.status_code': '201' } },
  { span_id: 'p5', parent_span_id: 'p2', action: 'CREATE_ACCOUNT', source: 'amie',
    started_at: t(715), ended_at: t(712), status: 0, kind: 'span',
    summary: 'Allocation account created.',
    attributes: { 'account.resource': 'expanse', 'allocation.id': 'alloc_TG-CCR' } },
  { span_id: 'p6', parent_span_id: 'p5', action: 'slurm.account.create', source: 'slurm',
    started_at: t(714), ended_at: t(713), status: 0, kind: 'event',
    summary: 'SLURM account created on cluster.',
    attributes: { 'slurm.cluster': 'expanse', 'slurm.account': 'TG-CCR250042' } },
  { span_id: 'p7', parent_span_id: 'p5', action: 'slurm.user.map', source: 'slurm',
    started_at: t(713), ended_at: t(712), status: 0, kind: 'event',
    summary: 'PI mapped to SLURM account.',
    attributes: { 'slurm.account': 'TG-CCR250042', 'slurm.user': 'anguyen' } },
  { span_id: 'p8', parent_span_id: 'p1', action: 'amie.reply', source: 'amie',
    started_at: t(711), ended_at: t(710), status: 0, kind: 'event',
    summary: 'Reply packet inform_transaction_complete sent.',
    attributes: { 'amie.reply_type': 'inform_transaction_complete' } },
  { span_id: 'p9', parent_span_id: 'p1', action: 'amie.audit:persist', source: 'core',
    started_at: t(710), ended_at: t(710), status: 0, kind: 'event',
    summary: 'Audit rows persisted.',
    attributes: { 'audit.rows': '9' } },
];

/* -------------------------------------------------------------
   IN-PROGRESS TRACE — still running (amber), 5 spans
   ------------------------------------------------------------- */
const INPROGRESS_SPANS = [
  { span_id: 'i1', parent_span_id: null, action: 'amie.process:request_account_create', source: 'amie',
    started_at: t(95), ended_at: null, status: null, kind: 'span', running: true,
    summary: 'Account create in progress.',
    attributes: { 'amie.packet_id': 'pkt_7c0d4e88', 'entity.user_id': 'usr_b21c9a04' } },
  { span_id: 'i2', parent_span_id: 'i1', action: 'amie.handle:request_account_create', source: 'amie',
    started_at: t(94), ended_at: null, status: null, kind: 'span', running: true,
    summary: 'Handler running.',
    attributes: { 'amie.handler': 'AccountCreateHandler' } },
  { span_id: 'i3', parent_span_id: 'i2', action: 'CREATE_PERSON', source: 'amie',
    started_at: t(93), ended_at: t(88), status: 0, kind: 'span',
    summary: 'Person created.',
    attributes: { 'person.id': 'pkt_7c0d4e88' } },
  { span_id: 'i4', parent_span_id: 'i3', action: 'ComanageProvisioningStarted', source: 'comanage',
    started_at: t(88), ended_at: null, status: null, kind: 'span', running: true,
    summary: 'COmanage provisioning in progress.',
    attributes: { 'comanage.co_person_id': 'co_90551' } },
  { span_id: 'i5', parent_span_id: 'i4', action: 'comanage.enroll:co_person', source: 'comanage',
    started_at: t(86), ended_at: null, status: null, kind: 'event', running: true,
    summary: 'Enrolling CO person in roles…',
    attributes: { 'comanage.co_id': '7' } },
];

/* -------------------------------------------------------------
   MULTI-ERROR TRACE — SLURM sync, 2 errors + 1 orphan (8 spans)
   ------------------------------------------------------------- */
const MULTI_ERR_SPANS = [
  { span_id: 'm1', parent_span_id: null, action: 'amie.process:request_account_inactivate', source: 'amie',
    started_at: t(1900), ended_at: t(1880), status: 1, kind: 'span',
    summary: 'Account inactivation failed on two SLURM clusters.',
    attributes: { 'amie.packet_id': 'pkt_0099fe12', 'entity.user_id': 'usr_3a77b1de' } },
  { span_id: 'm2', parent_span_id: 'm1', action: 'amie.handle:request_account_inactivate', source: 'amie',
    started_at: t(1899), ended_at: t(1880), status: 1, kind: 'span',
    summary: 'Handler ran inactivation across clusters.',
    attributes: { 'amie.handler': 'AccountInactivateHandler' } },
  { span_id: 'm3', parent_span_id: 'm2', action: 'slurm.account.sync', source: 'slurm',
    started_at: t(1898), ended_at: t(1895), status: 1, kind: 'event',
    summary: 'SLURM account sync failed on cluster expanse — sacctmgr returned non-zero.',
    status_message: 'SlurmCommandError: exit 1',
    attributes: { 'slurm.cluster': 'expanse', 'slurm.account': 'TG-CCR250042', 'slurm.exit_code': '1', 'error.kind': 'SlurmCommandError' } },
  { span_id: 'm4', parent_span_id: 'm2', action: 'slurm.account.sync', source: 'slurm',
    started_at: t(1896), ended_at: t(1893), status: 1, kind: 'event',
    summary: 'SLURM account sync failed on cluster anvil — connection timed out.',
    status_message: 'SlurmConnectionError: timeout',
    attributes: { 'slurm.cluster': 'anvil', 'slurm.account': 'TG-CCR250042', 'error.kind': 'SlurmConnectionError' } },
  { span_id: 'm5', parent_span_id: 'm2', action: 'slurm.user.unmap', source: 'slurm',
    started_at: t(1893), ended_at: null, status: null, kind: 'event', notRun: true,
    summary: 'Not run — sync failed.', attributes: { 'slurm.cluster': 'expanse' } },
  { span_id: 'm6', parent_span_id: 'm1', action: 'amie.reply', source: 'amie',
    started_at: t(1882), ended_at: null, status: null, kind: 'event', notRun: true,
    summary: 'Reply not sent — process ended in error.', attributes: {} },
  // orphan — parent_span_id points outside the trace
  { span_id: 'm7', parent_span_id: 'gone_xyz', action: 'comanage.webhook:role_changed', source: 'comanage',
    started_at: t(1885), ended_at: t(1884), status: 0, kind: 'event', orphan: true,
    summary: 'Async COmanage webhook landed without a resolvable parent span.',
    attributes: { 'comanage.co_person_id': 'co_44120', 'webhook.kind': 'role_changed' } },
  { span_id: 'm8', parent_span_id: 'm1', action: 'amie.audit:persist', source: 'core',
    started_at: t(1880), ended_at: t(1880), status: 0, kind: 'event',
    summary: 'Audit rows persisted.', attributes: { 'audit.rows': '8' } },
];

/* -------------------------------------------------------------
   TRACE LIST — newest first. Some carry full span trees,
   the rest are list-only filler for table density.
   ------------------------------------------------------------- */
const TRACES = [
  { trace_id: 'a3b1c92d3f4e5a6b7c8d9e0f1a2b3c4d', source: 'amie', started_at: t(132),
    root_action: 'amie.process:request_account_create', span_count: 14, status: 'error',
    error_summary: 'ComanageProvisioningFailed: 404', failing_span: 's8_failed',
    failing_action: 'comanage.create_person', over24h: false,
    entity: { 'amie.packet_id': 'pkt_a3b1c92d', 'entity.user_id': 'usr_4f2e1d6b' },
    spans: HERO_SPANS },

  { trace_id: '7c0d4e88a1b2c3d4e5f60718293a4b5c', source: 'amie', started_at: t(95),
    root_action: 'amie.process:request_account_create', span_count: 5, status: 'in-progress',
    error_summary: null, over24h: false,
    entity: { 'amie.packet_id': 'pkt_7c0d4e88', 'entity.user_id': 'usr_b21c9a04' },
    spans: INPROGRESS_SPANS },

  { trace_id: '1f0e9c20bb44aa55cc66dd77ee88ff99', source: 'http', started_at: t(420),
    root_action: 'http.POST /users/{id}/status', span_count: 3, status: 'ok',
    error_summary: null, over24h: false,
    entity: { 'entity.user_id': 'usr_9c4a01ff' }, spans: HEALTHY_HTTP_SPANS },

  { trace_id: '5d8e7b21a0c9f8e7d6c5b4a3928170ff', source: 'amie', started_at: t(720),
    root_action: 'amie.process:request_project_create', span_count: 9, status: 'ok',
    error_summary: null, over24h: false,
    entity: { 'amie.packet_id': 'pkt_5d8e7b21', 'entity.project_id': 'prj_22f1a0' }, spans: HEALTHY_PROJECT_SPANS },

  { trace_id: '0099fe12cd34ab56ef78019234565678', source: 'slurm', started_at: t(94000),
    root_action: 'amie.process:request_account_inactivate', span_count: 8, status: 'error',
    error_summary: 'SlurmCommandError + SlurmConnectionError (2 errors)', failing_action: 'slurm.account.sync',
    over24h: true,
    entity: { 'amie.packet_id': 'pkt_0099fe12', 'entity.user_id': 'usr_3a77b1de' }, spans: MULTI_ERR_SPANS },

  // ---- list-only filler (lighter trees generated on open) ----
  { trace_id: 'b8a01177ee22cc33dd44559966887700', source: 'comanage', started_at: t(1500),
    root_action: 'comanage.sync:co_person_roles', span_count: 6, status: 'ok', over24h: false,
    entity: { 'comanage.co_person_id': 'co_71204' } },
  { trace_id: 'c5f93b80112233445566778899aabbcc', source: 'amie', started_at: t(2400),
    root_action: 'amie.process:notify_project_user', span_count: 4, status: 'ok', over24h: false,
    entity: { 'amie.packet_id': 'pkt_c5f93b80' } },
  { trace_id: 'd1e2f3a40b1c2d3e4f5061728394a5b6', source: 'slurm', started_at: t(3100),
    root_action: 'slurm.account.sync', span_count: 2, status: 'error',
    error_summary: 'SlurmConnectionError: timeout', failing_action: 'slurm.account.sync', over24h: false,
    entity: { 'slurm.cluster': 'anvil' } },
  { trace_id: 'e7d6c5b4a3920817f6e5d4c3b2a19080', source: 'http', started_at: t(4200),
    root_action: 'http.GET /allocations/{id}', span_count: 2, status: 'ok', over24h: false,
    entity: { 'allocation.id': 'alloc_TG-CCR' } },
  { trace_id: 'f0a1b2c3d4e5f6a7b8c9d0e1f2a3b4c5', source: 'comanage', started_at: t(5400),
    root_action: 'comanage.provision:co_person', span_count: 7, status: 'error',
    error_summary: 'ComanageProvisioningFailed: 409 Conflict', failing_action: 'comanage.create_person', over24h: false,
    entity: { 'comanage.co_person_id': 'co_55019' } },
  { trace_id: 'aa11bb22cc33dd44ee55ff6600778899', source: 'amie', started_at: t(6600),
    root_action: 'amie.process:request_user_modify', span_count: 5, status: 'ok', over24h: false,
    entity: { 'amie.packet_id': 'pkt_aa11bb22' } },
  { trace_id: '99887766554433221100ffeeddccbbaa', source: 'core', started_at: t(98000),
    root_action: 'core.job:reconcile_allocations', span_count: 11, status: 'error',
    error_summary: 'ReconcileError: 3 allocations drifted', failing_action: 'core.reconcile', over24h: true,
    entity: { 'job.id': 'job_reconcile_0612' } },
];

// expose
Object.assign(window, { TRACES, NOW });
