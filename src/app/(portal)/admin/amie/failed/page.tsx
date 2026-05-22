import { AmieNav } from "../AmieNav";
import { AmiePermissionGate } from "../PermissionGate";
import { FailedQueueContainer } from "./FailedQueueContainer";

export default function AmieFailedPage() {
  return (
    <AmiePermissionGate>
      <div className="space-y-4">
        <header className="space-y-1">
          <h1 className="font-heading text-2xl font-semibold">Failed packet queue</h1>
          <p className="text-sm text-muted-foreground">
            Packets the handler couldn't process. Retry one-shot or in bulk; flag stuck packets with
            a manual resolution reason.
          </p>
        </header>
        <AmieNav />
        <FailedQueueContainer />
      </div>
    </AmiePermissionGate>
  );
}
