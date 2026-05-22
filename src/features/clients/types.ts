export const CLIENT_STATUSES = ["active", "deactivated"] as const;

export type ClientStatus = (typeof CLIENT_STATUSES)[number];

export type Client = {
  id: string;
  name: string;
  allocation_id: string;
  allocation_name?: string;
  owner_user_id: string;
  client_id: string;
  client_secret_last4: string;
  issued_at: string;
  last_rotated_at?: string;
  status: ClientStatus;
};

export type ClientListParams = {
  status?: ClientStatus | "all";
  allocationId?: string;
  ownerUserId?: string;
  limit?: number;
  offset?: number;
};

export type ClientListResponse = {
  clients: Client[];
  total: number;
  limit: number;
  offset: number;
};
