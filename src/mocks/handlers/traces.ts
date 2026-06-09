import { http, HttpResponse } from "msw";
import auditEventsFixture from "@features/tracing/__fixtures__/audit-events.fixture.json";
import statsFixture from "@features/tracing/__fixtures__/stats.fixture.json";
import amieFailedFixture from "@features/tracing/__fixtures__/trace.amie.failed.fixture.json";
import amieSuccessFixture from "@features/tracing/__fixtures__/trace.amie.success.fixture.json";
import httpTraceFixture from "@features/tracing/__fixtures__/trace.http.fixture.json";
import orphanedFixture from "@features/tracing/__fixtures__/trace.orphaned.fixture.json";
import listFixture from "@features/tracing/__fixtures__/traces.list.fixture.json";
import { path } from "./_utils";

const MAX_LIMIT = 200;
const DEFAULT_LIMIT = 50;
const MAX_OFFSET = 1_000_000;
const MAX_WINDOW_DAYS = 365;

const detailIndex = new Map<string, unknown>([
  [amieFailedFixture.trace.trace_id, amieFailedFixture],
  [amieSuccessFixture.trace.trace_id, amieSuccessFixture],
  [httpTraceFixture.trace.trace_id, httpTraceFixture],
  [orphanedFixture.trace.trace_id, orphanedFixture],
]);

const HEX_TRACE = /^[0-9a-f]{32}$/;

function multi(url: URL, key: string): string[] {
  const out: string[] = [];
  for (const raw of url.searchParams.getAll(key)) {
    for (const part of raw.split(",")) {
      const v = part.trim();
      if (v) out.push(v);
    }
  }
  return out;
}

function inWindow(iso: string, from: string | null, to: string | null): boolean {
  const ts = Date.parse(iso);
  if (Number.isNaN(ts)) return true;
  if (from) {
    const f = Date.parse(from);
    if (!Number.isNaN(f) && ts < f) return false;
  }
  if (to) {
    const t = Date.parse(to);
    if (!Number.isNaN(t) && ts > t) return false;
  }
  return true;
}

export const tracesHandlers = [
  http.get(path("/admin/traces"), ({ request }) => {
    const url = new URL(request.url);
    const sources = multi(url, "source");
    const statuses = multi(url, "status")
      .map((s) => Number.parseInt(s, 10))
      .filter((n) => Number.isInteger(n));
    const from = url.searchParams.get("from");
    const to = url.searchParams.get("to");
    const q = url.searchParams.get("q")?.trim().toLowerCase() ?? "";

    const limitRaw = Number.parseInt(url.searchParams.get("limit") ?? "", 10);
    const offsetRaw = Number.parseInt(url.searchParams.get("offset") ?? "", 10);
    if (Number.isFinite(offsetRaw) && offsetRaw > MAX_OFFSET) {
      return HttpResponse.json({ error: "offset exceeds maximum" }, { status: 400 });
    }
    const limit = Number.isFinite(limitRaw) && limitRaw > 0
      ? Math.min(limitRaw, MAX_LIMIT)
      : DEFAULT_LIMIT;
    const offset = Number.isFinite(offsetRaw) && offsetRaw >= 0 ? offsetRaw : 0;

    let rows = listFixture.traces.slice();
    if (sources.length) rows = rows.filter((t) => sources.includes(t.source));
    if (statuses.length) rows = rows.filter((t) => statuses.includes(t.status));
    rows = rows.filter((t) => inWindow(t.started_at, from, to));
    if (q) {
      rows = rows.filter(
        (t) =>
          t.trace_id.toLowerCase().includes(q) || t.root_name.toLowerCase().includes(q),
      );
    }

    const total = rows.length;
    const page = rows.slice(offset, offset + limit);
    return HttpResponse.json({ traces: page, total, limit, offset });
  }),

  http.get(path("/admin/traces/stats"), ({ request }) => {
    const url = new URL(request.url);
    const window = url.searchParams.get("window") ?? "30d";
    if (window.endsWith("d")) {
      const n = Number.parseInt(window.slice(0, -1), 10);
      if (!Number.isFinite(n) || n <= 0) {
        return HttpResponse.json({ error: "invalid window" }, { status: 400 });
      }
      if (n > MAX_WINDOW_DAYS) {
        return HttpResponse.json({ error: "window exceeds maximum of 365d" }, { status: 400 });
      }
    }
    return HttpResponse.json(statsFixture);
  }),

  http.get(path("/admin/traces/:traceId"), ({ params }) => {
    const traceId = String(params.traceId);
    if (!HEX_TRACE.test(traceId)) {
      return HttpResponse.json({ error: "invalid trace id" }, { status: 400 });
    }
    const fixture = detailIndex.get(traceId);
    if (fixture) return HttpResponse.json(fixture);
    // List fixture has more rows than detail fixtures — synthesize a minimal
    // detail from the list row so every clickable row resolves to something
    // renderable.
    const listRow = listFixture.traces.find((t) => t.trace_id === traceId);
    if (listRow) {
      return HttpResponse.json({
        trace: listRow,
        spans: [
          {
            span_id: traceId.slice(0, 16),
            name: listRow.root_name,
            kind: 1,
            status: listRow.status,
            start_time: listRow.started_at,
            end_time: listRow.ended_at ?? null,
          },
        ],
      });
    }
    return HttpResponse.json({ error: "trace not found" }, { status: 404 });
  }),

  // Retry handler — matches backend status codes (§11.3):
  //   202 on success, 422 for orphaned (no root_event), 409 for sources
  //   without a registered RetryableSource (using http fixture as the stand-in).
  http.post(path("/admin/traces/:traceId/retry"), ({ params }) => {
    const traceId = String(params.traceId);
    if (!HEX_TRACE.test(traceId)) {
      return HttpResponse.json({ error: "invalid trace id" }, { status: 400 });
    }
    if (traceId === orphanedFixture.trace.trace_id) {
      return HttpResponse.json(
        {
          error:
            "AMIE retry requires the original packet payload; this trace was recorded before payload capture was active",
        },
        { status: 422 },
      );
    }
    if (traceId === httpTraceFixture.trace.trace_id) {
      return HttpResponse.json(
        { error: "source http not registered for retry" },
        { status: 409 },
      );
    }
    return new HttpResponse(null, { status: 202 });
  }),

  http.get(path("/admin/audit-events"), ({ request }) => {
    const url = new URL(request.url);
    const traceId = url.searchParams.get("trace_id") ?? "";
    if (!HEX_TRACE.test(traceId)) {
      return HttpResponse.json({ error: "invalid trace id" }, { status: 400 });
    }
    if (traceId === amieFailedFixture.trace.trace_id) {
      return HttpResponse.json(auditEventsFixture);
    }
    return HttpResponse.json({ audit_events: [], amie_audit_log: [] });
  }),
];
