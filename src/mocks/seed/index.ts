import type { Adjustment, UnmappedJob } from "@features/admin/schemas";
import type {
  AllocationStatus,
  ComputeAllocation,
  ComputeAllocationResource,
  ComputeAllocationResourceMapping,
  ComputeAllocationResourceRate,
  ComputeCluster,
} from "@features/allocations/schemas";
import type { Packet, PacketEvent, Reply } from "@features/amie/types";
import type { Job, QueueWaitTime } from "@features/analytics/schemas";
import type { SavedView } from "@features/analytics/views/types";
import type { Client } from "@features/clients/types";
import type { MembershipRole } from "@features/members/roles";
import type {
  ComputeAllocationMembership,
  ComputeAllocationMembershipResourceOverride,
  User,
  UserIdentity,
} from "@features/members/schemas";
import type { Project } from "@features/projects/schemas";
import type { Proposal } from "@features/proposals/types";
import type { Certificate } from "@features/signer/types";
import type { ComputeAllocationUsage, ComputeAllocationUsageTotal } from "@features/usage/schemas";
import type {
  ComputeAllocationChangeRequest,
  ComputeAllocationChangeRequestEvent,
  ComputeAllocationDiff,
} from "@shared/api/domain";
import { buildAmieSeed } from "./amie";
import { clientSlug, nextClientRowId } from "./ids";
import { daysFromNow, hoursFromNow, makeRng, pick, rangeInt } from "./random";

const FIRST_NAMES = [
  "Riya",
  "Pat",
  "Avery",
  "Jordan",
  "Sam",
  "Robin",
  "Taylor",
  "Casey",
  "Quinn",
  "Morgan",
  "Reese",
  "Drew",
  "Sky",
  "Devon",
  "Hayden",
  "Alex",
  "Cameron",
  "Parker",
  "Rowan",
  "Sage",
];
const LAST_NAMES = [
  "Researcher",
  "PI",
  "Admin",
  "Chen",
  "Patel",
  "Garcia",
  "Kim",
  "Nguyen",
  "Singh",
  "Yamada",
  "Schmidt",
  "Rossi",
  "Silva",
  "Oduya",
  "Okafor",
  "Khan",
  "Lopez",
  "Hassan",
];

const RESOURCE_TYPES = ["cpu", "gpu"] as const;
const RESOURCE_NAME_POOL = [
  "cpu-standard",
  "cpu-largemem",
  "gpu-a100",
  "gpu-h100",
  "gpu-interactive",
  "cpu-haswell",
];
const ORIGINATIONS = ["ACCESS", "NAIRR", "XRASS", "INTERNAL"] as const;

export type Seed = {
  clusters: ComputeCluster[];
  organizations: Array<{ id: string; originated_id: string; name: string }>;
  projects: Project[];
  users: User[];
  identities: UserIdentity[];
  allocations: ComputeAllocation[];
  resources: ComputeAllocationResource[];
  resourceMappings: ComputeAllocationResourceMapping[];
  resourceRates: ComputeAllocationResourceRate[];
  memberships: ComputeAllocationMembership[];
  membershipRoles: Record<string, MembershipRole>;
  overrides: ComputeAllocationMembershipResourceOverride[];
  usages: ComputeAllocationUsage[];
  changeRequests: ComputeAllocationChangeRequest[];
  changeRequestEvents: ComputeAllocationChangeRequestEvent[];
  diffs: ComputeAllocationDiff[];
  proposals: Proposal[];
  certificates: Certificate[];
  clients: Client[];
  amiePackets: Packet[];
  amieEvents: PacketEvent[];
  amieReplies: Reply[];
  unmappedJobs: UnmappedJob[];
  adjustments: Adjustment[];
  jobs: Job[];
  queueWaitTimes: QueueWaitTime[];
  savedViews: SavedView[];
  preferences: Record<string, { timezone: string; notify_on_change_request_decided: boolean; notify_on_proposal_decided: boolean }>;
};

function statusFor(rng: () => number): AllocationStatus {
  const n = rng();
  if (n < 0.85) return "ACTIVE";
  if (n < 0.95) return "INACTIVE";
  return "DELETED";
}

export function buildSeed(): Seed {
  const rng = makeRng(0x5eed1);

  const clusters: ComputeCluster[] = [
    { id: "cluster-001", name: "Nexus-A" },
    { id: "cluster-002", name: "Nexus-B" },
  ];

  const organizations = [
    { id: "org-001", originated_id: "access-org-001", name: "University of Nexus" },
    { id: "org-002", originated_id: "access-org-002", name: "Nexus Labs Inc" },
    { id: "org-003", originated_id: "access-org-003", name: "Pacific Institute" },
  ];

  const personaUsers: User[] = [
    {
      id: "researcher@nexus.local",
      organization_id: "org-001",
      first_name: "Riya",
      last_name: "Researcher",
      email: "researcher@nexus.local",
      status: "ACTIVE",
    },
    {
      id: "pi@nexus.local",
      organization_id: "org-001",
      first_name: "Pat",
      last_name: "PI",
      email: "pi@nexus.local",
      status: "ACTIVE",
    },
    {
      id: "admin@nexus.local",
      organization_id: "org-001",
      first_name: "Avery",
      last_name: "Admin",
      email: "admin@nexus.local",
      status: "ACTIVE",
    },
  ];

  const users: User[] = [...personaUsers];
  // Pool dedup by derived email: two random user-NNN ids would collide on the same
  // (first_name, last_name) -> email otherwise, producing visual duplicates.
  const takenEmails = new Set(personaUsers.map((u) => u.email));
  let userSeq = 0;
  let userAttempts = 0;
  while (userSeq < 50 && userAttempts < 200) {
    userAttempts += 1;
    const first = pick(rng, FIRST_NAMES);
    const last = pick(rng, LAST_NAMES);
    const email = `${first.toLowerCase()}.${last.toLowerCase()}@nexus.local`;
    if (takenEmails.has(email)) continue;
    takenEmails.add(email);
    userSeq += 1;
    users.push({
      id: `user-${String(userSeq).padStart(3, "0")}`,
      organization_id: pick(rng, organizations).id,
      first_name: first,
      last_name: last,
      email,
      status: "ACTIVE",
    });
  }

  const identities: UserIdentity[] = users.flatMap((u, i) => {
    const created = daysFromNow(-rangeInt(rng, 30, 365)).toISOString();
    return [
      {
        id: `ident-access-${i + 1}`,
        user_id: u.id,
        source: "access",
        external_id: `ACCESS-${100000 + i}`,
        email: u.email,
        oidc_sub: `access|${u.id}`,
        created_at: created,
      },
    ];
  });

  const projects: Project[] = [];
  for (let i = 0; i < 50; i += 1) {
    const pi = pick(rng, users.slice(0, 8));
    const created = daysFromNow(-rangeInt(rng, 30, 730)).toISOString();
    projects.push({
      id: `project-${String(i + 1).padStart(3, "0")}`,
      originated_id: `BIO${130000 + i}`,
      title: `Research Project ${i + 1}`,
      origination: pick(rng, ORIGINATIONS),
      project_pi_id: pi.id,
      status: rng() < 0.92 ? "ACTIVE" : "INACTIVE",
      created_time: created,
    });
  }

  const allocations: ComputeAllocation[] = [];
  const resources: ComputeAllocationResource[] = [];
  const resourceMappings: ComputeAllocationResourceMapping[] = [];
  const resourceRates: ComputeAllocationResourceRate[] = [];
  const memberships: ComputeAllocationMembership[] = [];
  const membershipRoles: Record<string, MembershipRole> = {};
  const overrides: ComputeAllocationMembershipResourceOverride[] = [];
  const usages: ComputeAllocationUsage[] = [];
  const changeRequests: ComputeAllocationChangeRequest[] = [];
  const changeRequestEvents: ComputeAllocationChangeRequestEvent[] = [];
  const diffs: ComputeAllocationDiff[] = [];

  let allocCount = 0;
  for (const project of projects) {
    const allocCountForProject = rangeInt(rng, 1, 5);
    for (let k = 0; k < allocCountForProject; k += 1) {
      if (allocCount >= 200) break;
      allocCount += 1;
      const id = `alloc-${String(allocCount).padStart(3, "0")}`;
      const startOffset = -rangeInt(rng, 30, 180);
      const lengthDays = rangeInt(rng, 90, 365);
      const status = statusFor(rng);
      const allocation: ComputeAllocation = {
        id,
        project_id: project.id,
        name: `${project.originated_id}-alloc-${k + 1}`,
        status,
        compute_cluster_id: pick(rng, clusters).id,
        initial_su_amount: rangeInt(rng, 5000, 200000),
        start_time: daysFromNow(startOffset).toISOString(),
        end_time: daysFromNow(startOffset + lengthDays).toISOString(),
      };
      allocations.push(allocation);

      const resourceCount = rangeInt(rng, 1, 4);
      const allocResources: ComputeAllocationResource[] = [];
      for (let r = 0; r < resourceCount; r += 1) {
        const resource: ComputeAllocationResource = {
          id: `${id}-res-${r + 1}`,
          name: pick(rng, RESOURCE_NAME_POOL),
          resource_type: pick(rng, RESOURCE_TYPES),
          resource_amount: rangeInt(rng, 4, 128),
        };
        resources.push(resource);
        allocResources.push(resource);
        resourceMappings.push({
          id: `${id}-map-${r + 1}`,
          compute_allocation_id: id,
          compute_allocation_resource_id: resource.id,
          resource_amount: resource.resource_amount,
          resource_time: rangeInt(rng, 60, 1440) * 30,
        });
        resourceRates.push({
          id: `${id}-rate-${r + 1}`,
          compute_allocation_resource_id: resource.id,
          rate: resource.resource_type === "gpu" ? 2 + rng() * 3 : 0.5 + rng(),
          start_time: allocation.start_time,
          end_time: allocation.end_time,
        });
      }

      const memberCount = rangeInt(rng, 1, 8);
      const piMembership: ComputeAllocationMembership = {
        id: `${id}-mem-pi`,
        compute_allocation_id: id,
        user_id: project.project_pi_id,
        start_time: allocation.start_time,
        end_time: allocation.end_time,
        membership_status: "ACTIVE",
      };
      memberships.push(piMembership);
      membershipRoles[piMembership.id] = "pi";
      const memberPool = users.filter((u) => u.id !== project.project_pi_id);
      const pickedMembers = new Set<string>([project.project_pi_id]);
      let memberSeq = 0;
      let attempts = 0;
      // Loop until we have memberCount unique members or we've tried 4x that many
      // — earlier code silently dropped duplicates and produced short lists.
      while (pickedMembers.size < memberCount && attempts < memberCount * 4) {
        attempts += 1;
        const candidate = pick(rng, memberPool);
        if (pickedMembers.has(candidate.id)) continue;
        pickedMembers.add(candidate.id);
        memberSeq += 1;
        const memId = `${id}-mem-${memberSeq}`;
        memberships.push({
          id: memId,
          compute_allocation_id: id,
          user_id: candidate.id,
          start_time: daysFromNow(startOffset + rangeInt(rng, 0, 30)).toISOString(),
          end_time: allocation.end_time,
          membership_status: rng() < 0.94 ? "ACTIVE" : "INACTIVE",
        });
        membershipRoles[memId] = memberSeq === 1 && rng() < 0.3 ? "co_pi" : "user";
      }

      const personaResearcher = personaUsers.find((u) => u.id === "researcher@nexus.local");
      if (personaResearcher && !pickedMembers.has(personaResearcher.id) && allocCount % 8 === 1) {
        pickedMembers.add(personaResearcher.id);
        const researcherMemId = `${id}-mem-researcher`;
        memberships.push({
          id: researcherMemId,
          compute_allocation_id: id,
          user_id: personaResearcher.id,
          start_time: daysFromNow(startOffset + 10).toISOString(),
          end_time: allocation.end_time,
          membership_status: "ACTIVE",
        });
        membershipRoles[researcherMemId] = "user";
      }

      const cycleHours = 24 * 30;
      for (let h = 0; h < cycleHours; h += 1) {
        if (rng() > 0.05) continue;
        const usageResource = allocResources[rangeInt(rng, 0, allocResources.length - 1)];
        if (!usageResource) continue;
        usages.push({
          id: `${id}-usage-${h}`,
          compute_allocation_id: id,
          used_raw_amount: rangeInt(rng, 10, 200),
          used_su_amount: rangeInt(rng, 20, 500),
          last_updated: hoursFromNow(-h).toISOString(),
          user_id: memberships[memberships.length - 1]?.user_id ?? project.project_pi_id,
          job_id: `job-${id}-${h}`,
          compute_allocation_resource_id: usageResource.id,
        });
      }

      const changeCount = rangeInt(rng, 0, 2);
      for (let c = 0; c < changeCount; c += 1) {
        const reqId = `${id}-cr-${c + 1}`;
        const requester = pick(rng, [...pickedMembers]);
        const reqStatus = pick(rng, ["PENDING", "APPROVED", "REJECTED"] as const);
        changeRequests.push({
          id: reqId,
          compute_allocation_id: id,
          requested_su_amount: allocation.initial_su_amount + rangeInt(rng, 1000, 10000),
          requested_status: "ACTIVE",
          reason: `Need more SUs for ${project.title}`,
          change_status: reqStatus,
          requester_id: requester,
          approver_id: reqStatus !== "PENDING" ? "admin@nexus.local" : undefined,
          timestamp: daysFromNow(-rangeInt(rng, 1, 60)).toISOString(),
        });
        changeRequestEvents.push({
          id: `${reqId}-evt-created`,
          compute_allocation_change_request_id: reqId,
          event_type: "CREATED",
          description: "Change request created",
          timestamp: daysFromNow(-rangeInt(rng, 5, 60)).toISOString(),
        });
        if (reqStatus !== "PENDING") {
          changeRequestEvents.push({
            id: `${reqId}-evt-${reqStatus.toLowerCase()}`,
            compute_allocation_change_request_id: reqId,
            event_type: reqStatus,
            description: `Change request ${reqStatus.toLowerCase()}`,
            timestamp: daysFromNow(-rangeInt(rng, 0, 5)).toISOString(),
          });
        }
      }

      const diffCount = rangeInt(rng, 0, 3);
      for (let d = 0; d < diffCount; d += 1) {
        diffs.push({
          id: `${id}-diff-${d + 1}`,
          compute_allocation_id: id,
          diff_type: pick(rng, ["USAGE_UPDATE", "ALLOCATION_STATUS_CHANGE", "RATE_UPDATE"]),
          new_su_amount: rangeInt(rng, 1000, allocation.initial_su_amount),
          status: allocation.status,
          timestamp: daysFromNow(-rangeInt(rng, 1, 30)).toISOString(),
          description: "Synthetic diff entry",
        });
      }

      const overrideCount = rangeInt(rng, 0, 2);
      for (let o = 0; o < overrideCount; o += 1) {
        const targetMembership = memberships[memberships.length - 1 - o];
        const targetResource = allocResources[0];
        if (!targetMembership || !targetResource) continue;
        overrides.push({
          id: `${id}-override-${o + 1}`,
          compute_allocation_membership_id: targetMembership.id,
          compute_allocation_resource_id: targetResource.id,
          override_resource_amount: rangeInt(rng, 1, 32),
          override_resource_time: rangeInt(rng, 60, 600) * 30,
        });
      }
    }
    if (allocCount >= 200) break;
  }

  const proposals: Proposal[] = [];
  const statusPlan: Array<{ status: Proposal["status"]; count: number }> = [
    { status: "DRAFT", count: 3 },
    { status: "SUBMITTED", count: 4 },
    { status: "UNDER_REVIEW", count: 3 },
    { status: "APPROVED", count: 3 },
    { status: "DENIED", count: 2 },
  ];
  let proposalSeq = 0;
  for (const { status, count } of statusPlan) {
    for (let i = 0; i < count; i += 1) {
      proposalSeq += 1;
      const project = projects[(proposalSeq * 7) % projects.length];
      if (!project) continue;
      const projectAllocResources = resources.filter((r) =>
        allocations.some((a) => a.project_id === project.id && r.id.startsWith(`${a.id}-res`)),
      );
      const pickedResources =
        projectAllocResources.length > 0 ? projectAllocResources : resources.slice(0, 2);
      const proposalResources = pickedResources.slice(0, rangeInt(rng, 1, 3)).map((r) => ({
        resource_id: r.id,
        resource_name: r.name,
        resource_type: r.resource_type,
        requested_su_amount: rangeInt(rng, 5000, 80000),
      }));
      const startOffset = rangeInt(rng, 7, 60);
      const lengthDays = rangeInt(rng, 90, 365);
      const cascade = rng() < 0.4;
      const childAllocations = cascade
        ? [
            {
              project_id: `${project.id}-sub-a`,
              project_title: `${project.title} — Sub A`,
              su_split_percent: 60,
            },
            {
              project_id: `${project.id}-sub-b`,
              project_title: `${project.title} — Sub B`,
              su_split_percent: 40,
            },
          ]
        : [];
      const createdAt = daysFromNow(-rangeInt(rng, 1, 90)).toISOString();
      const decided = status === "APPROVED" || status === "DENIED";
      proposals.push({
        id: `prop-${String(proposalSeq).padStart(3, "0")}`,
        project_id: project.id,
        project_title: project.title,
        requester_id: project.project_pi_id,
        title: `Proposal: ${project.title} — Phase ${proposalSeq}`,
        abstract: `Extension proposal for ${project.title}. Targets a downstream milestone with quantitative deliverables across ${proposalResources.length} resource pool(s).`,
        justification: [
          `Project ${project.title} (origination ${project.origination}) is approaching a critical milestone that requires additional compute capacity.`,
          "We have characterized the workload, profiled hot paths, and validated scaling on existing nodes.",
          "This proposal requests sustained capacity for the next quarter to complete the planned set of experiments, integrate downstream collaborators, and publish results.",
          "The plan includes regular check-ins with the allocation manager and quarterly reporting on burn rate and outcomes.",
          "Without this allocation the team would be forced to defer the publication window by at least one cycle, which materially affects funder commitments.",
          "We commit to releasing reproducible artifacts at the end of the cycle.",
        ].join(" "),
        start_date: daysFromNow(startOffset).toISOString(),
        end_date: daysFromNow(startOffset + lengthDays).toISOString(),
        resources: proposalResources,
        cascade_to_sub_projects: cascade,
        child_allocations: childAllocations,
        status,
        decision: decided
          ? {
              decided_by: "admin@nexus.local",
              decided_at: daysFromNow(-rangeInt(rng, 0, 10)).toISOString(),
              decision_note:
                status === "APPROVED"
                  ? "Aligned with quarterly capacity plan."
                  : "Burn rate on current allocation does not justify the requested extension.",
            }
          : undefined,
        created_at: createdAt,
        updated_at: createdAt,
      });
    }
  }

  const clients: Client[] = [];
  for (let i = 0; i < 25; i += 1) {
    const ownerUser = pick(rng, users.slice(0, 12));
    const ownerMemberships = memberships.filter((m) => m.user_id === ownerUser.id);
    const ownerAllocation =
      ownerMemberships.length > 0
        ? (allocations.find((a) => a.id === ownerMemberships[0]?.compute_allocation_id) ??
          allocations[i % allocations.length])
        : allocations[i % allocations.length];
    if (!ownerAllocation) continue;
    const issuedAt = daysFromNow(-rangeInt(rng, 1, 200)).toISOString();
    const rotated = rng() < 0.3 ? daysFromNow(-rangeInt(rng, 1, 60)).toISOString() : undefined;
    clients.push({
      id: nextClientRowId(clients.map((c) => c.id)),
      name: `Pipeline ${i + 1}`,
      allocation_id: ownerAllocation.id,
      allocation_name: ownerAllocation.name,
      owner_user_id: ownerUser.id,
      client_id: clientSlug(ownerAllocation.id, i + 1),
      client_secret_last4: String(rangeInt(rng, 1000, 9999)),
      issued_at: issuedAt,
      last_rotated_at: rotated,
      status: rng() < 0.85 ? "active" : "deactivated",
    });
  }

  const certificates: Certificate[] = [];
  const STATUS_PLAN = [
    { count: 50, kind: "active" as const },
    { count: 18, kind: "expired" as const },
    { count: 12, kind: "revoked" as const },
  ];
  let certSerial = 1000;
  const nowSeconds = Math.floor(Date.now() / 1000);
  for (const plan of STATUS_PLAN) {
    for (let i = 0; i < plan.count; i += 1) {
      const owningUser = pick(rng, users.slice(0, 14));
      const memberAllocations = memberships
        .filter((m) => m.user_id === owningUser.id)
        .map((m) => allocations.find((a) => a.id === m.compute_allocation_id))
        .filter((a): a is NonNullable<typeof a> => Boolean(a));
      const cluster =
        memberAllocations.length > 0
          ? memberAllocations[certSerial % memberAllocations.length]
          : allocations[certSerial % allocations.length];
      if (!cluster) continue;
      const lifetimeSeconds = rangeInt(rng, 3600, 8 * 3600);
      const issuedAt =
        plan.kind === "expired"
          ? nowSeconds - rangeInt(rng, lifetimeSeconds + 60, 30 * 24 * 3600)
          : nowSeconds - rangeInt(rng, 60, 6 * 3600);
      const validAfter = issuedAt;
      const validBefore =
        plan.kind === "expired"
          ? issuedAt + lifetimeSeconds
          : nowSeconds + rangeInt(rng, 60, lifetimeSeconds);
      const revoked = plan.kind === "revoked";
      const revokedAt = revoked
        ? Math.max(issuedAt + 60, nowSeconds - rangeInt(rng, 60, 7 * 24 * 3600))
        : undefined;
      certificates.push({
        serial_number: certSerial,
        allocation_id: cluster.id,
        allocation_name: cluster.name,
        key_id: `nexus-key-${certSerial}`,
        principal: owningUser.email.split("@")[0] ?? owningUser.id,
        username: owningUser.email,
        public_key_fingerprint: `SHA256:${certSerial.toString(16).padStart(8, "0")}${"abcdef".repeat(4)}`,
        ca_fingerprint: `SHA256:ca-${certSerial.toString(16).padStart(4, "0")}`,
        valid_after: validAfter,
        valid_before: validBefore,
        issued_at: issuedAt,
        source_ip: `10.${rangeInt(rng, 0, 255)}.${rangeInt(rng, 0, 255)}.${rangeInt(rng, 1, 254)}`,
        granted_extensions: ["permit-pty", ...(rng() < 0.5 ? ["permit-agent-forwarding"] : [])],
        force_command: rng() < 0.1 ? "/usr/local/bin/nexus-shell" : null,
        revoked,
        revoked_at: revokedAt,
        revocation_reason: revoked
          ? pick(rng, [
              "User requested revocation",
              "Suspected key compromise",
              "Allocation ended",
              "Account deactivated",
            ])
          : undefined,
      });
      certSerial += 1;
    }
  }

  const projectOriginatedIds = projects.map((p) => p.originated_id);
  const amie = buildAmieSeed({ projectIds: projectOriginatedIds, total: 100 });

  const UNMAPPED_REASONS = [
    "Unknown project code in job context",
    "Username not in any allocation membership",
    "Allocation expired before job submission",
    "Cluster name not recognized",
  ];
  const unmappedJobs: UnmappedJob[] = [];
  for (let i = 0; i < 18; i += 1) {
    const cluster = pick(rng, clusters);
    const submittedAt = hoursFromNow(-rangeInt(rng, 1, 96));
    const u = pick(rng, users);
    const jobId = `slurm-${String(2_500_000 + rangeInt(rng, 0, 999_999))}`;
    unmappedJobs.push({
      id: `umj-${String(i + 1).padStart(3, "0")}`,
      job_id: jobId,
      username: u.email.split("@")[0] ?? u.id,
      cluster: cluster.name,
      walltime_seconds: rangeInt(rng, 60, 8 * 3600),
      su_charged: rangeInt(rng, 5, 5000),
      reason: pick(rng, UNMAPPED_REASONS),
      raw_data: {
        accounting_record: `JOBID=${jobId} USER=${u.email.split("@")[0]} CLUSTER=${cluster.name}`,
        partition: rng() < 0.5 ? "compute" : "gpu",
        nodes: rangeInt(rng, 1, 8),
        cpus_per_node: rangeInt(rng, 8, 64),
      },
      observed_at: submittedAt.toISOString(),
    });
  }

  const adjustments: Adjustment[] = [];
  const adjustmentTypes: Array<Adjustment["type"]> = ["CREDIT", "DEBIT", "EXPIRE"];
  for (let i = 0; i < 12; i += 1) {
    const alloc = allocations[i * 7] ?? allocations[i] ?? allocations[0];
    if (!alloc) break;
    adjustments.push({
      id: `adj-${String(i + 1).padStart(3, "0")}`,
      allocation_id: alloc.id,
      allocation_name: alloc.name,
      type: pick(rng, adjustmentTypes),
      amount: rangeInt(rng, 100, 25_000),
      reason: pick(rng, [
        "Goodwill credit for cluster outage 2026-03",
        "Reclaim — over-allocated at quarterly review",
        "PI requested write-off after burn audit",
        "Expire stale allocation per retention policy",
      ]),
      created_by: "admin@nexus.local",
      created_at: daysFromNow(-rangeInt(rng, 1, 60)).toISOString(),
    });
  }

  // Analytics jobs + queue wait-time — MSW-only in v1 (no backend yet; see
  // docs/backend-contracts/analytics.md). Distribute across allocations and
  // bias toward the researcher persona so /analytics has visible rows.
  const jobs: Job[] = [];
  const researcherId = "researcher@nexus.local";
  const researcherMemberships = memberships.filter((m) => m.user_id === researcherId);
  for (let i = 0; i < 200; i += 1) {
    // Every 3rd job goes to the researcher persona so the e2e + manual demo
    // see a populated table without having to bulk-create memberships.
    const useResearcher = i % 3 === 0 && researcherMemberships.length > 0;
    const membership = useResearcher
      ? (researcherMemberships[i % researcherMemberships.length] as ComputeAllocationMembership)
      : (memberships[(i * 13) % memberships.length] as ComputeAllocationMembership);
    if (!membership) continue;
    const allocation = allocations.find((a) => a.id === membership.compute_allocation_id);
    if (!allocation) continue;
    const allocResources = resources.filter((r) => r.id.startsWith(`${allocation.id}-res`));
    const resource = allocResources[i % Math.max(1, allocResources.length)];
    if (!resource) continue;
    const startedAt = hoursFromNow(-rangeInt(rng, 1, 30 * 24));
    const statusRoll = rng();
    const status: Job["status"] =
      statusRoll < 0.85
        ? "COMPLETED"
        : statusRoll < 0.92
          ? "RUNNING"
          : statusRoll < 0.97
            ? "FAILED"
            : "CANCELLED";
    jobs.push({
      job_id: `job-${String(i + 1).padStart(5, "0")}`,
      user_id: membership.user_id,
      allocation_id: allocation.id,
      resource_id: resource.id,
      started_at: startedAt.toISOString(),
      su_used: rangeInt(rng, 50, 8000),
      wait_seconds: rangeInt(rng, 30, 60 * 30),
      status,
    });
  }

  // Seed a couple of saved analytics views per dev persona so the chip strip
  // is non-empty on first load (spec §9 Phase A4). One is marked default per
  // persona to exercise the auto-apply path on a fresh navigation.
  const savedViewsNow = new Date().toISOString();
  const savedViews: SavedView[] = [
    {
      id: "view-researcher-weekly",
      user_id: "researcher@nexus.local",
      name: "Last 7 days",
      persona: "researcher",
      range: {
        from: hoursFromNow(-7 * 24).toISOString(),
        to: new Date().toISOString(),
        preset: "7d",
      },
      group_by: ["resource", "all"],
      filters: {},
      is_default: true,
      created_at: savedViewsNow,
      updated_at: savedViewsNow,
    },
    {
      id: "view-researcher-quarter",
      user_id: "researcher@nexus.local",
      name: "This quarter",
      persona: "researcher",
      range: {
        from: hoursFromNow(-90 * 24).toISOString(),
        to: new Date().toISOString(),
        preset: "90d",
      },
      group_by: ["resource", "all"],
      filters: {},
      is_default: false,
      created_at: savedViewsNow,
      updated_at: savedViewsNow,
    },
    {
      id: "view-pi-weekly",
      user_id: "pi@nexus.local",
      name: "Weekly review",
      persona: "pi",
      range: {
        from: hoursFromNow(-7 * 24).toISOString(),
        to: new Date().toISOString(),
        preset: "7d",
      },
      group_by: ["all", "all", "all"],
      filters: {},
      is_default: true,
      created_at: savedViewsNow,
      updated_at: savedViewsNow,
    },
    {
      id: "view-pi-quarter",
      user_id: "pi@nexus.local",
      name: "Quarter rollup",
      persona: "pi",
      range: {
        from: hoursFromNow(-90 * 24).toISOString(),
        to: new Date().toISOString(),
        preset: "90d",
      },
      group_by: ["all", "all", "all"],
      filters: {},
      is_default: false,
      created_at: savedViewsNow,
      updated_at: savedViewsNow,
    },
    {
      id: "view-admin-daily",
      user_id: "admin@nexus.local",
      name: "Yesterday",
      persona: "admin",
      range: {
        from: hoursFromNow(-24).toISOString(),
        to: new Date().toISOString(),
        preset: "24h",
      },
      group_by: ["all", "all", "all"],
      filters: {},
      is_default: true,
      created_at: savedViewsNow,
      updated_at: savedViewsNow,
    },
    {
      id: "view-admin-monthly",
      user_id: "admin@nexus.local",
      name: "Last 30 days",
      persona: "admin",
      range: {
        from: hoursFromNow(-30 * 24).toISOString(),
        to: new Date().toISOString(),
        preset: "30d",
      },
      group_by: ["all", "all", "all"],
      filters: {},
      is_default: false,
      created_at: savedViewsNow,
      updated_at: savedViewsNow,
    },
  ];

  const QUEUE_NAMES = ["normal", "gpu", "largemem", "debug", "interactive"];
  const queueWaitTimes: QueueWaitTime[] = QUEUE_NAMES.map((queue) => {
    const p50 = rangeInt(rng, 60, 400);
    const p90 = p50 + rangeInt(rng, 60, 800);
    return {
      queue,
      avg_wait_seconds: Math.round((p50 + p90) / 2),
      p50,
      p90,
      sample_size: rangeInt(rng, 40, 400),
    };
  });

  return {
    clusters,
    organizations,
    projects,
    users,
    identities,
    allocations,
    resources,
    resourceMappings,
    resourceRates,
    memberships,
    membershipRoles,
    overrides,
    usages,
    changeRequests,
    changeRequestEvents,
    diffs,
    proposals,
    certificates,
    clients,
    amiePackets: amie.packets,
    amieEvents: amie.events,
    amieReplies: amie.replies,
    unmappedJobs,
    adjustments,
    jobs,
    queueWaitTimes,
    savedViews,
    preferences: {},
  };
}

// Singleton: MSW mutations live on this seed in-memory. We pin it to globalThis
// so HMR re-evaluation reuses the same dataset, and we mirror it to localStorage
// so a full-page reload (sign-out + sign-in) restores user-submitted rows
// instead of rebuilding from scratch.
type SeedHolder = { __nexusSeed?: Seed };
const holder = globalThis as unknown as SeedHolder;

const STORAGE_KEY = "nexus.msw.seed.v1";

function getStorage(): Storage | null {
  try {
    if (typeof window === "undefined") return null;
    return window.localStorage;
  } catch {
    return null;
  }
}

// Merge hydrated snapshot over a fresh build so new top-level fields added in
// later phases (amiePackets, amieEvents, amieReplies, …) are backfilled while
// the user's mutations from prior sessions survive.
export function mergeHydrated(fresh: Seed, hydrated: Partial<Seed> | null): Seed {
  if (!hydrated || typeof hydrated !== "object") return fresh;
  return { ...fresh, ...hydrated } as Seed;
}

function tryHydrate(): Partial<Seed> | null {
  const storage = getStorage();
  if (!storage) return null;
  try {
    const raw = storage.getItem(STORAGE_KEY);
    if (!raw) return null;
    const parsed = JSON.parse(raw);
    if (!parsed || typeof parsed !== "object") return null;
    return parsed as Partial<Seed>;
  } catch {
    return null;
  }
}

export function persistSeed(): void {
  const storage = getStorage();
  if (!storage) return;
  try {
    storage.setItem(STORAGE_KEY, JSON.stringify(holder.__nexusSeed));
  } catch {
    // Storage quota or serialization failure — best effort, do not crash MSW.
  }
}

if (!holder.__nexusSeed) {
  const hydrated = tryHydrate();
  const fresh = buildSeed();
  holder.__nexusSeed = mergeHydrated(fresh, hydrated);
  // Repersist after merge so newly backfilled fields land in localStorage too.
  persistSeed();
}

// All handlers read seed through this getter so a re-import after sign-out
// always sees the holder's current snapshot.
export function getSeed(): Seed {
  return holder.__nexusSeed as Seed;
}

// Back-compat export. Stays in sync with the holder because it IS the holder
// object reference. Mutations through `seed.x.push(...)` mutate the holder.
export const seed: Seed = holder.__nexusSeed;

export function getAllocationUsageTotalRow(allocId: string): ComputeAllocationUsageTotal {
  const total = seed.usages
    .filter((u) => u.compute_allocation_id === allocId)
    .reduce((acc, u) => acc + u.used_su_amount, 0);
  return { compute_allocation_id: allocId, total_su_amount: total };
}

export function getAllocationUserUsageTotalRow(
  allocId: string,
  userId: string,
): { compute_allocation_id: string; user_id: string; total_su_amount: number } {
  const total = seed.usages
    .filter((u) => u.compute_allocation_id === allocId && u.user_id === userId)
    .reduce((acc, u) => acc + u.used_su_amount, 0);
  return { compute_allocation_id: allocId, user_id: userId, total_su_amount: total };
}
