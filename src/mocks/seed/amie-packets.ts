export type AmiePacketStatus = "NEW" | "DECODED" | "PROCESSED" | "FAILED";

export type AmiePacket = {
  id: string;
  amie_id: string;
  type: string;
  status: AmiePacketStatus;
  source: string;
  received_at: string;
  updated_at: string;
  linked_entity_ref?: string;
};

const TYPES = [
  "request_project_create",
  "request_account_create",
  "request_person_merge",
  "request_project_inactivate",
  "inform_project_create",
] as const;

const STATUSES: AmiePacketStatus[] = ["NEW", "DECODED", "PROCESSED", "PROCESSED", "FAILED"];

function hoursAgo(hours: number): string {
  return new Date(Date.now() - hours * 60 * 60 * 1000).toISOString();
}

export const amiePackets: AmiePacket[] = Array.from({ length: 10 }).map((_, i) => {
  const status = STATUSES[i % STATUSES.length] as AmiePacketStatus;
  const hours = i === 0 ? 36 : i * 3;
  return {
    id: `amie-${String(i + 1).padStart(3, "0")}`,
    amie_id: `AMIE-${100000 + i}`,
    type: TYPES[i % TYPES.length] as string,
    status,
    source: "access",
    received_at: hoursAgo(hours),
    updated_at: hoursAgo(Math.max(0, hours - 1)),
    linked_entity_ref: status === "PROCESSED" ? `project-${String(i + 1).padStart(3, "0")}` : undefined,
  };
});

export function amieFailed24h(packets: AmiePacket[] = amiePackets): number {
  const cutoff = Date.now() - 24 * 60 * 60 * 1000;
  return packets.filter((p) => {
    if (p.status !== "FAILED") return false;
    const t = new Date(p.received_at).getTime();
    return !Number.isNaN(t) && t >= cutoff;
  }).length;
}

export function amieFailedTotal(packets: AmiePacket[] = amiePackets): number {
  return packets.filter((p) => p.status === "FAILED").length;
}
