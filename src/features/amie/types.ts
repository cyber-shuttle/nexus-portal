// Mirrors the Go model in
// airavata-custos/connectors/ACCESS/AMIE-Processor/model/{packet,event,audit}.go.
// Keep the snake_case fields aligned with the connector — the MSW layer is a
// drop-in stand-in for the real HTTP contract.

export type PacketStatus = "NEW" | "DECODED" | "PROCESSED" | "FAILED";

// Every packet type the connector's handler/router.go currently understands,
// plus the inform_* types it emits as replies.
export const PACKET_TYPES = [
  "request_project_create",
  "request_project_inactivate",
  "request_project_reactivate",
  "request_account_create",
  "request_account_inactivate",
  "request_account_reactivate",
  "request_person_merge",
  "request_user_modify",
  "data_account_create",
  "data_project_create",
  "inform_transaction_complete",
  "notify_project_create",
  "notify_account_create",
] as const;

export type PacketType = (typeof PACKET_TYPES)[number];

export type LinkedEntityType = "project" | "account" | "person" | "user_merge";

export type LinkedEntityRef = {
  type: LinkedEntityType;
  id: string;
  display_id?: string;
};

export type Packet = {
  id: string;
  amie_id: string;
  type: string;
  status: PacketStatus;
  source: string;
  raw_json?: string;
  decoded_payload?: Record<string, unknown>;
  received_at: string;
  updated_at: string;
  decoded_at?: string;
  processed_at?: string;
  retries: number;
  last_error?: string;
  linked_entity?: LinkedEntityRef;
};

export type PacketEventType =
  | "RECEIVED"
  | "DECODED"
  | "HANDLED"
  | "RETRY_SCHEDULED"
  | "RETRY"
  | "FAILED"
  | "MANUAL_RESOLVE"
  | "MANUAL_LINK";

export type PacketEvent = {
  id: string;
  packet_id: string;
  event_type: PacketEventType;
  actor: string;
  status: "SUCCEEDED" | "FAILED" | "RUNNING";
  message?: string;
  timestamp: string;
  duration_ms?: number;
};

export type PacketAudit = {
  id: string;
  packet_id: string;
  event_id?: string;
  action: string;
  entity_type: string;
  entity_id?: string;
  summary?: string;
  created_at: string;
};

export type ReplyStatus = "PENDING" | "SENT" | "ACKED" | "FAILED";

export type Reply = {
  id: string;
  amie_id: string;
  type: string;
  status: ReplyStatus;
  in_reply_to_packet_id?: string;
  sent_at?: string;
  acked_at?: string;
  retries: number;
  last_error?: string;
  created_at: string;
};

export type UnmappedPacket = Packet & {
  status: "DECODED";
  linked_entity: undefined;
};

export type PacketStatBucket = {
  date: string;
  status: PacketStatus;
  type: string;
  count: number;
};

export type PacketStats = {
  byDay: PacketStatBucket[];
};

export type PacketListResponse = {
  packets: Packet[];
  total: number;
  limit: number;
  offset: number;
};

export type ReplyListResponse = {
  replies: Reply[];
  total: number;
  limit: number;
  offset: number;
};
