export type Permission = {
  key: string;
  label: string;
};

export type RWPermission = {
  read: boolean;
  write: boolean;
};

export type UserPermissionRecord = {
  id: string;
  name: string;
  email: string;
  role: string;
  canManageAllocations: RWPermission;
  canViewReports: RWPermission;
  canManageUsers: RWPermission;
  extra: Permission[];
  isMe?: boolean;
};

export const USERS: UserPermissionRecord[] = [
  {
    id: "me",
    name: "Nipuna Bandara",
    email: "nipuna@folia.com",
    role: "Admin",
    canManageAllocations: { read: true, write: true },
    canViewReports: { read: true, write: true },
    canManageUsers: { read: true, write: true },
    isMe: true,
    extra: [
      { key: "manage_clients", label: "Manage Clients" },
      { key: "manage_resources", label: "Manage Resources" },
      { key: "manage_rates", label: "Manage Rates" },
      { key: "retry_traces", label: "Retry Traces" },
      { key: "view_traces", label: "View Traces" },
      { key: "manage_adjustments", label: "Manage Adjustments" },
    ],
  },
  {
    id: "u1",
    name: "Rachel Gao",
    email: "rgao@access-ci.org",
    role: "PI",
    canManageAllocations: { read: true, write: true },
    canViewReports: { read: true, write: false },
    canManageUsers: { read: false, write: false },
    extra: [
      { key: "create_proposals", label: "Create Proposals" },
      { key: "manage_membership", label: "Manage Membership" },
      { key: "approve_change_requests", label: "Approve Change Requests" },
      { key: "view_analytics", label: "View Analytics (PI)" },
    ],
  },
  {
    id: "u2",
    name: "James Okonkwo",
    email: "jokonkwo@university.edu",
    role: "Researcher",
    canManageAllocations: { read: false, write: false },
    canViewReports: { read: true, write: false },
    canManageUsers: { read: false, write: false },
    extra: [
      { key: "view_analytics", label: "View Analytics (Self)" },
      { key: "create_change_requests", label: "Create Change Requests" },
    ],
  },
  {
    id: "u3",
    name: "Priya Sharma",
    email: "psharma@hpc-lab.org",
    role: "Allocation Manager",
    canManageAllocations: { read: true, write: true },
    canViewReports: { read: true, write: false },
    canManageUsers: { read: false, write: false },
    extra: [
      { key: "approve_change_requests", label: "Approve Change Requests" },
      { key: "manage_membership", label: "Manage Membership" },
      { key: "view_analytics", label: "View Analytics (Self)" },
    ],
  },
  {
    id: "u4",
    name: "Daniel Wu",
    email: "dwu@nexus-hpc.io",
    role: "Researcher",
    canManageAllocations: { read: false, write: false },
    canViewReports: { read: false, write: false },
    canManageUsers: { read: false, write: false },
    extra: [{ key: "create_change_requests", label: "Create Change Requests" }],
  },
];

export type RolePermissionRecord = {
  role: string;
  description: string;
  canManageAllocations: RWPermission;
  canViewReports: RWPermission;
  canManageUsers: RWPermission;
  extra: Permission[];
};

export const ROLE_PERMISSIONS: RolePermissionRecord[] = [
  {
    role: "Admin",
    description: "Full administrative access across the portal.",
    canManageAllocations: { read: true, write: true },
    canViewReports: { read: true, write: true },
    canManageUsers: { read: true, write: true },
    extra: [
      { key: "manage_clients", label: "Manage Clients" },
      { key: "manage_resources", label: "Manage Resources" },
      { key: "manage_rates", label: "Manage Rates" },
      { key: "retry_traces", label: "Retry Traces" },
      { key: "view_traces", label: "View Traces" },
      { key: "manage_adjustments", label: "Manage Adjustments" },
    ],
  },
  {
    role: "PI",
    description: "Manages allocations, membership, and proposals for their group.",
    canManageAllocations: { read: true, write: true },
    canViewReports: { read: true, write: false },
    canManageUsers: { read: false, write: false },
    extra: [
      { key: "create_proposals", label: "Create Proposals" },
      { key: "manage_membership", label: "Manage Membership" },
      { key: "approve_change_requests", label: "Approve Change Requests" },
      { key: "view_analytics", label: "View Analytics (PI)" },
    ],
  },
  {
    role: "Allocation Manager",
    description: "Oversees allocation usage and approves change requests.",
    canManageAllocations: { read: true, write: true },
    canViewReports: { read: true, write: false },
    canManageUsers: { read: false, write: false },
    extra: [
      { key: "approve_change_requests", label: "Approve Change Requests" },
      { key: "manage_membership", label: "Manage Membership" },
      { key: "view_analytics", label: "View Analytics (Self)" },
    ],
  },
  {
    role: "Researcher",
    description: "Standard portal access for running and viewing their own work.",
    canManageAllocations: { read: false, write: false },
    canViewReports: { read: true, write: false },
    canManageUsers: { read: false, write: false },
    extra: [
      { key: "view_analytics", label: "View Analytics (Self)" },
      { key: "create_change_requests", label: "Create Change Requests" },
    ],
  },
];
