import { AmieNav } from "../AmieNav";
import { AmiePermissionGate } from "../PermissionGate";
import { ReplyTrackerContainer } from "./ReplyTrackerContainer";

export default function AmieRepliesPage() {
  return (
    <AmiePermissionGate>
      <div className="space-y-4">
        <header className="space-y-1">
          <h1 className="font-heading text-2xl font-semibold">Reply tracker</h1>
          <p className="text-sm text-muted-foreground">
            Outgoing inform_* packets we send back to ACCESS. Retry any that failed or are stuck
            PENDING.
          </p>
        </header>
        <AmieNav />
        <ReplyTrackerContainer />
      </div>
    </AmiePermissionGate>
  );
}
