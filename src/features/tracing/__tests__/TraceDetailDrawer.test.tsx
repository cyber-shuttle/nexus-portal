import amieSuccessFixture from "@features/tracing/__fixtures__/trace.amie.success.fixture.json";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { render, screen, waitFor } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

const replace = vi.fn();
const push = vi.fn();
vi.mock("next/navigation", () => ({
  useRouter: () => ({ replace, push }),
  useSearchParams: () => new URLSearchParams(),
}));

vi.mock("@shared/casl/AbilityProvider", () => ({
  useAbility: () => ({ can: () => true }),
}));

vi.mock("next/dynamic", () => ({
  default: () =>
    function StubJsonView({ data }: { data: unknown }) {
      return <pre data-testid="payload-json">{JSON.stringify(data)}</pre>;
    },
}));

const fetchMock = vi.fn();

beforeEach(() => {
  replace.mockReset();
  push.mockReset();
  vi.stubGlobal("fetch", fetchMock as unknown as typeof fetch);
});

afterEach(() => {
  fetchMock.mockReset();
  vi.unstubAllGlobals();
});

import { TraceDetailDrawer } from "../components/TraceDetailDrawer";

function makeClient() {
  return new QueryClient({
    defaultOptions: { queries: { retry: false, gcTime: 0, staleTime: 0 } },
  });
}

function renderDrawer(props: { traceId: string | null; open: boolean }) {
  const onClose = vi.fn();
  const client = makeClient();
  render(
    <QueryClientProvider client={client}>
      <TraceDetailDrawer traceId={props.traceId} open={props.open} onClose={onClose} />
    </QueryClientProvider>,
  );
  return { onClose };
}

describe("TraceDetailDrawer", () => {
  it("does not fetch when open=false", async () => {
    renderDrawer({ traceId: "a3b1c92d3f4e5a6b7c8d9e0f12345678", open: false });
    await new Promise((r) => setTimeout(r, 0));
    expect(fetchMock).not.toHaveBeenCalled();
  });

  it("fetches and renders all four tabs when open with a known trace id", async () => {
    fetchMock.mockResolvedValueOnce(
      new Response(JSON.stringify(amieSuccessFixture), {
        status: 200,
        headers: { "content-type": "application/json" },
      }),
    );
    renderDrawer({
      traceId: amieSuccessFixture.trace.trace_id,
      open: true,
    });
    await waitFor(() => {
      expect(fetchMock).toHaveBeenCalled();
    });
    await waitFor(() => {
      expect(screen.getByRole("tab", { name: /Overview/i })).toBeInTheDocument();
    });
    expect(screen.getByRole("tab", { name: /Waterfall/i })).toBeInTheDocument();
    expect(screen.getByRole("tab", { name: /Raw JSON/i })).toBeInTheDocument();
    expect(screen.getByRole("tab", { name: /Linked/i })).toBeInTheDocument();
  });

  it("renders a skeleton while loading", async () => {
    let resolveFetch: ((value: Response) => void) | undefined;
    fetchMock.mockReturnValueOnce(
      new Promise<Response>((resolve) => {
        resolveFetch = resolve;
      }),
    );
    render(
      <QueryClientProvider client={makeClient()}>
        <TraceDetailDrawer traceId={amieSuccessFixture.trace.trace_id} open onClose={() => {}} />
      </QueryClientProvider>,
    );
    // SideDrawer portals into document.body; query against the document root.
    await waitFor(() => {
      expect(document.body.querySelector('[data-slot="skeleton"]')).not.toBeNull();
    });
    if (resolveFetch) {
      resolveFetch(
        new Response(JSON.stringify(amieSuccessFixture), {
          status: 200,
          headers: { "content-type": "application/json" },
        }),
      );
    }
  });

  it("renders an error state when the fetch fails", async () => {
    fetchMock.mockResolvedValueOnce(
      new Response(JSON.stringify({ error: "boom" }), {
        status: 500,
        headers: { "content-type": "application/json" },
      }),
    );
    renderDrawer({
      traceId: amieSuccessFixture.trace.trace_id,
      open: true,
    });
    await waitFor(() => {
      expect(screen.getByRole("button", { name: /try again|retry/i })).toBeInTheDocument();
    });
  });
});
