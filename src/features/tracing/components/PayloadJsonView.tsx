"use client";

import { JsonView, defaultStyles } from "react-json-view-lite";
import "react-json-view-lite/dist/index.css";

// Matches the react-json-view-lite `Props.data` shape (object or array). The
// overview tab only renders this when stringifyPayload returned a JSON object,
// so non-object payloads are filtered upstream.
export type PayloadJsonViewProps = {
  data: object | Array<unknown>;
};

// Collapsed-by-default to depth 2 so the typical AMIE payload shows the
// top-level keys without flooding the drawer with nested objects.
export default function PayloadJsonView({ data }: PayloadJsonViewProps) {
  return (
    <div className="overflow-x-auto rounded-md border bg-background p-3 text-xs">
      <JsonView data={data} shouldExpandNode={(level) => level < 2} style={defaultStyles} />
    </div>
  );
}
