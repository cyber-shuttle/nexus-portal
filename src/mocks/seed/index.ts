import type {
  AllocationStatus,
  ComputeAllocation,
  ComputeAllocationResource,
  ComputeAllocationResourceMapping,
  ComputeAllocationResourceRate,
  ComputeCluster,
  Project,
} from "@features/allocations/schemas";
import type {
  ComputeAllocationMembership,
  ComputeAllocationMembershipResourceOverride,
  User,
  UserIdentity,
} from "@features/members/schemas";
import type {
  ComputeAllocationUsage,
  ComputeAllocationUsageTotal,
} from "@features/usage/schemas";
import type {
  ComputeAllocationChangeRequest,
  ComputeAllocationChangeRequestEvent,
  ComputeAllocationDiff,
} from "@features/audit/schemas";
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
  overrides: ComputeAllocationMembershipResourceOverride[];
  usages: ComputeAllocationUsage[];
  changeRequests: ComputeAllocationChangeRequest[];
  changeRequestEvents: ComputeAllocationChangeRequestEvent[];
  diffs: ComputeAllocationDiff[];
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
  for (let i = 0; i < 50; i += 1) {
    const first = pick(rng, FIRST_NAMES);
    const last = pick(rng, LAST_NAMES);
    const id = `user-${String(i + 1).padStart(3, "0")}`;
    users.push({
      id,
      organization_id: pick(rng, organizations).id,
      first_name: first,
      last_name: last,
      email: `${first.toLowerCase()}.${last.toLowerCase()}@nexus.local`,
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
      const memberPool = users.filter((u) => u.id !== project.project_pi_id);
      const pickedMembers = new Set<string>([project.project_pi_id]);
      for (let m = 0; m < memberCount - 1; m += 1) {
        const candidate = pick(rng, memberPool);
        if (pickedMembers.has(candidate.id)) continue;
        pickedMembers.add(candidate.id);
        memberships.push({
          id: `${id}-mem-${m + 1}`,
          compute_allocation_id: id,
          user_id: candidate.id,
          start_time: daysFromNow(startOffset + rangeInt(rng, 0, 30)).toISOString(),
          end_time: allocation.end_time,
          membership_status: rng() < 0.94 ? "ACTIVE" : "INACTIVE",
        });
      }

      const personaResearcher = personaUsers.find((u) => u.id === "researcher@nexus.local");
      if (personaResearcher && allocCount % 8 === 1) {
        memberships.push({
          id: `${id}-mem-researcher`,
          compute_allocation_id: id,
          user_id: personaResearcher.id,
          start_time: daysFromNow(startOffset + 10).toISOString(),
          end_time: allocation.end_time,
          membership_status: "ACTIVE",
        });
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
    overrides,
    usages,
    changeRequests,
    changeRequestEvents,
    diffs,
  };
}

export const seed: Seed = buildSeed();

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
