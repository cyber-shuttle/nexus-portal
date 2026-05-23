import type { HttpHandler } from "msw";
import { adminHandlers } from "./admin";
import { allocationHandlers } from "./allocations";
import { amieHandlers } from "./amie";
import { analyticsViewsHandlers } from "./analytics-views";
import { changeRequestHandlers } from "./change-requests";
import { clientHandlers } from "./clients";
import { diffHandlers } from "./diffs";
import { identityHandlers } from "./identities";
import { jobsHandlers } from "./jobs";
import { membershipHandlers } from "./memberships";
import { proposalHandlers } from "./proposals";
import { resourceHandlers } from "./resources";
import { signerHandlers } from "./signer";
import { toolsHandlers } from "./tools";
import { userHandlers } from "./users";

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
  ...toolsHandlers,
  ...signerHandlers,
  ...clientHandlers,
  ...amieHandlers,
  ...jobsHandlers,
  ...analyticsViewsHandlers,
];
