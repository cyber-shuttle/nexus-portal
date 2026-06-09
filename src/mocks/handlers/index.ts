import type { HttpHandler } from "msw";
import { adminHandlers } from "./admin";
import { allocationHandlers } from "./allocations";
import { amieHandlers } from "./amie";
import { analyticsViewsHandlers } from "./analytics-views";
import { changeRequestHandlers } from "./change-requests";
import { clientHandlers } from "./clients";
import { clusterHandlers } from "./clusters";
import { diffHandlers } from "./diffs";
import { feedbackGithubHandlers } from "./feedback-github";
import { identityHandlers } from "./identities";
import { jobsHandlers } from "./jobs";
import { membershipHandlers } from "./memberships";
import { projectHandlers } from "./projects";
import { proposalHandlers } from "./proposals";
import { resourceHandlers } from "./resources";
import { signerHandlers } from "./signer";
import { toolsHandlers } from "./tools";
import { tracesHandlers } from "./traces";
import { userHandlers } from "./users";

export const handlers: HttpHandler[] = [
  ...allocationHandlers,
  ...resourceHandlers,
  ...membershipHandlers,
  // projectHandlers must come before userHandlers so /projects routes win.
  ...projectHandlers,
  ...userHandlers,
  ...identityHandlers,
  ...changeRequestHandlers,
  ...diffHandlers,
  ...adminHandlers,
  ...clusterHandlers,
  ...proposalHandlers,
  ...toolsHandlers,
  ...signerHandlers,
  ...clientHandlers,
  ...amieHandlers,
  ...tracesHandlers,
  ...jobsHandlers,
  ...analyticsViewsHandlers,
  ...feedbackGithubHandlers,
];
