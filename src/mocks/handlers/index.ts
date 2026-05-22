import type { HttpHandler } from "msw";
import { allocationHandlers } from "./allocations";
import { resourceHandlers } from "./resources";
import { membershipHandlers } from "./memberships";
import { userHandlers } from "./users";
import { identityHandlers } from "./identities";
import { changeRequestHandlers } from "./change-requests";
import { diffHandlers } from "./diffs";
import { adminHandlers } from "./admin";
import { proposalHandlers } from "./proposals";

export const handlers: HttpHandler[] = [
  ...allocationHandlers,
  ...resourceHandlers,
  ...membershipHandlers,
  ...userHandlers,
  ...identityHandlers,
  ...changeRequestHandlers,
  ...diffHandlers,
  ...adminHandlers,
  ...proposalHandlers,
];
