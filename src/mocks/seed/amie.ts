import type { Packet, PacketEvent, PacketStatus, PacketType, Reply } from "@features/amie/types";
import { PACKET_TYPES } from "@features/amie/types";
import { daysFromNow, hoursFromNow, makeRng, pick, rangeInt } from "./random";

export type AmieSeed = {
  packets: Packet[];
  events: PacketEvent[];
  replies: Reply[];
};

const STATUS_WEIGHTS: Array<{ status: PacketStatus; weight: number }> = [
  { status: "PROCESSED", weight: 0.74 },
  { status: "DECODED", weight: 0.1 },
  { status: "FAILED", weight: 0.09 },
  { status: "NEW", weight: 0.07 },
];

function weightedStatus(rng: () => number): PacketStatus {
  const n = rng();
  let acc = 0;
  for (const { status, weight } of STATUS_WEIGHTS) {
    acc += weight;
    if (n < acc) return status;
  }
  return "PROCESSED";
}

function samplePayload(
  rng: () => number,
  type: PacketType,
  projectIds: string[],
): Record<string, unknown> {
  const projectId = projectIds[Math.floor(rng() * projectIds.length)] ?? "BIO130000";
  switch (type) {
    case "request_project_create":
      return {
        ProjectID: projectId,
        PfosNumber: `BIO${rangeInt(rng, 130000, 139999)}`,
        ResourceList: ["nexus.access-ci.org"],
        StartTime: daysFromNow(-rangeInt(rng, 0, 30)).toISOString(),
        Pi: {
          PersonID: `bl-pi-${rangeInt(rng, 1, 99)}`,
          FirstName: "Pat",
          LastName: "First",
          Email: `pat${rangeInt(rng, 1, 99)}@example.edu`,
          OrgCode: "BASELINE",
        },
      };
    case "request_account_create":
      return {
        ProjectID: projectId,
        AccountUserPersonID: `bl-user-${rangeInt(rng, 1, 99)}`,
        ResourceList: ["nexus.access-ci.org"],
      };
    case "request_person_merge":
      return {
        KeepPersonID: `bl-pi-${rangeInt(rng, 1, 50)}`,
        DeletePersonID: `bl-pi-${rangeInt(rng, 51, 99)}`,
      };
    case "data_account_create":
      return {
        ProjectID: projectId,
        AccountUserPersonID: `bl-user-${rangeInt(rng, 1, 99)}`,
        ResourceLogin: `pat${rangeInt(rng, 1, 99)}`,
        StartTime: daysFromNow(-rangeInt(rng, 0, 30)).toISOString(),
      };
    case "data_project_create":
      return {
        ProjectID: projectId,
        Allocations: [
          { AllocationType: "new", ServiceUnitsAllocated: rangeInt(rng, 10000, 200000) },
        ],
      };
    case "request_user_modify":
      return {
        UserPersonID: `bl-user-${rangeInt(rng, 1, 99)}`,
        Email: `updated${rangeInt(rng, 1, 99)}@example.edu`,
      };
    case "inform_transaction_complete":
      return {
        TransactionID: `txn-${rangeInt(rng, 1, 1000)}`,
        Status: "complete",
      };
    case "request_project_inactivate":
    case "request_project_reactivate":
      return { ProjectID: projectId };
    case "request_account_inactivate":
    case "request_account_reactivate":
      return {
        ProjectID: projectId,
        AccountUserPersonID: `bl-user-${rangeInt(rng, 1, 99)}`,
      };
    case "notify_project_create":
    case "notify_account_create":
      return {
        ProjectID: projectId,
        Notice: "Site processing complete",
      };
    default:
      return { note: "synthetic" };
  }
}

function eventTimelineFor(rng: () => number, packet: Packet, events: PacketEvent[]): void {
  const received = new Date(packet.received_at).getTime();
  events.push({
    id: `${packet.id}-evt-received`,
    packet_id: packet.id,
    event_type: "RECEIVED",
    actor: "amie-worker",
    status: "SUCCEEDED",
    message: "Packet pulled from AMIE inbox",
    timestamp: new Date(received).toISOString(),
    duration_ms: rangeInt(rng, 5, 50),
  });
  if (packet.status === "NEW") return;
  const decodedAt = received + rangeInt(rng, 100, 5000);
  events.push({
    id: `${packet.id}-evt-decoded`,
    packet_id: packet.id,
    event_type: "DECODED",
    actor: "amie-worker",
    status: "SUCCEEDED",
    message: "Decoded packet body",
    timestamp: new Date(decodedAt).toISOString(),
    duration_ms: rangeInt(rng, 20, 200),
  });
  if (packet.status === "DECODED") return;
  const handledAt = decodedAt + rangeInt(rng, 500, 60_000);
  if (packet.status === "PROCESSED") {
    events.push({
      id: `${packet.id}-evt-handled`,
      packet_id: packet.id,
      event_type: "HANDLED",
      actor: "amie-worker",
      status: "SUCCEEDED",
      message: "Handler completed successfully",
      timestamp: new Date(handledAt).toISOString(),
      duration_ms: rangeInt(rng, 50, 800),
    });
    return;
  }
  // FAILED — typically one or more retries before giving up.
  const retries = packet.retries;
  let cursor = handledAt;
  for (let i = 0; i < retries; i += 1) {
    cursor += rangeInt(rng, 30_000, 180_000);
    events.push({
      id: `${packet.id}-evt-retry-${i + 1}`,
      packet_id: packet.id,
      event_type: "RETRY",
      actor: "amie-worker",
      status: "FAILED",
      message: packet.last_error ?? "transient failure",
      timestamp: new Date(cursor).toISOString(),
      duration_ms: rangeInt(rng, 50, 800),
    });
  }
  events.push({
    id: `${packet.id}-evt-failed`,
    packet_id: packet.id,
    event_type: "FAILED",
    actor: "amie-worker",
    status: "FAILED",
    message: packet.last_error ?? "unknown handler error",
    timestamp: new Date(cursor + rangeInt(rng, 1000, 5000)).toISOString(),
    duration_ms: rangeInt(rng, 50, 800),
  });
}

export function buildAmieSeed(opts: { projectIds: string[]; total?: number }): AmieSeed {
  const rng = makeRng(0xa11e);
  const total = opts.total ?? 100;

  const packets: Packet[] = [];
  const events: PacketEvent[] = [];
  const replies: Reply[] = [];

  for (let i = 0; i < total; i += 1) {
    const type = pick(rng, PACKET_TYPES) as PacketType;
    const status = weightedStatus(rng);
    const hoursAgo = rangeInt(rng, 1, 30 * 24);
    const received = hoursFromNow(-hoursAgo).toISOString();
    const updated = hoursFromNow(-Math.max(0, hoursAgo - rangeInt(rng, 0, 3))).toISOString();
    const retries = status === "FAILED" ? rangeInt(rng, 1, 4) : 0;
    const decoded = status === "PROCESSED" || status === "DECODED" || status === "FAILED";
    const handled = status === "PROCESSED";
    const payload = samplePayload(rng, type, opts.projectIds);
    const failedReason =
      status === "FAILED"
        ? pick(rng, [
            "site connector returned 502",
            "duplicate AMIE id",
            "downstream timeout",
            "validation failed: missing PfosNumber",
            "core upsert deadlock",
          ])
        : undefined;
    const packet: Packet = {
      id: `pkt-${String(i + 1).padStart(4, "0")}`,
      amie_id: `${rangeInt(rng, 1_000_000, 9_999_999)}`,
      type,
      status,
      source: "access",
      raw_json: JSON.stringify({ packet_type: type, ...payload }, null, 2),
      decoded_payload: payload,
      received_at: received,
      updated_at: updated,
      decoded_at: decoded ? hoursFromNow(-(hoursAgo - 0.5)).toISOString() : undefined,
      processed_at: handled ? updated : undefined,
      retries,
      last_error: failedReason,
      linked_entity: handled
        ? {
            type:
              type.startsWith("request_account") || type.includes("account")
                ? "account"
                : type.includes("merge")
                  ? "user_merge"
                  : "project",
            id: opts.projectIds[i % opts.projectIds.length] ?? "project-001",
            display_id: `${opts.projectIds[i % opts.projectIds.length] ?? "BIO130001"}`,
          }
        : undefined,
    };
    packets.push(packet);
    eventTimelineFor(rng, packet, events);
  }

  // One sticky FAILED packet from 36 hours ago to exercise the "loud" age UX.
  const sticky: Packet = {
    id: "pkt-sticky-001",
    amie_id: "9000001",
    type: "request_account_create",
    status: "FAILED",
    source: "access",
    raw_json: JSON.stringify(
      {
        packet_type: "request_account_create",
        ProjectID: opts.projectIds[0] ?? "project-001",
        AccountUserPersonID: "bl-user-sticky",
      },
      null,
      2,
    ),
    decoded_payload: {
      ProjectID: opts.projectIds[0] ?? "project-001",
      AccountUserPersonID: "bl-user-sticky",
    },
    received_at: hoursFromNow(-36).toISOString(),
    updated_at: hoursFromNow(-1).toISOString(),
    decoded_at: hoursFromNow(-35).toISOString(),
    retries: 5,
    last_error: "site connector returned 502 — manual intervention required",
  };
  packets.unshift(sticky);
  eventTimelineFor(makeRng(0x573c), sticky, events);

  // Outgoing inform_* replies. Mix of statuses.
  const replyPlan: Array<{ status: Reply["status"]; count: number }> = [
    { status: "ACKED", count: 18 },
    { status: "SENT", count: 8 },
    { status: "PENDING", count: 2 },
    { status: "FAILED", count: 2 },
  ];
  let replySeq = 0;
  for (const { status, count } of replyPlan) {
    for (let i = 0; i < count; i += 1) {
      replySeq += 1;
      const createdAt = hoursFromNow(-rangeInt(rng, 1, 30 * 24)).toISOString();
      const sentAt =
        status === "PENDING" ? undefined : hoursFromNow(-rangeInt(rng, 0, 23)).toISOString();
      const ackedAt =
        status === "ACKED" ? hoursFromNow(-rangeInt(rng, 0, 22)).toISOString() : undefined;
      const linked = packets[replySeq % packets.length];
      replies.push({
        id: `rply-${String(replySeq).padStart(3, "0")}`,
        amie_id: `${rangeInt(rng, 1_000_000, 9_999_999)}`,
        type: pick(rng, [
          "inform_project_create",
          "inform_account_create",
          "inform_transaction_complete",
        ]),
        status,
        in_reply_to_packet_id: linked?.id,
        sent_at: sentAt,
        acked_at: ackedAt,
        retries: status === "FAILED" ? rangeInt(rng, 1, 3) : 0,
        last_error: status === "FAILED" ? "ACCESS endpoint returned 504" : undefined,
        created_at: createdAt,
      });
    }
  }

  return { packets, events, replies };
}
