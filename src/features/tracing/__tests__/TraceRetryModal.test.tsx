import amieFailedFixture from "@features/tracing/__fixtures__/trace.amie.failed.fixture.json";
import type { Span, Trace } from "@features/tracing/types";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { fireEvent, render, screen, waitFor } from "@testing-library/react";
import type * as React from "react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

const toastSuccess = vi.fn();
const toastError = vi.fn();
vi.mock("sonner", () => ({
  toast: {
    success: (...args: unknown[]) => toastSuccess(...args),
    error: (...args: unknown[]) => toastError(...args),
  },
}));

// next/dynamic returns a passthrough so PayloadJsonView renders synchronously.
vi.mock("next/dynamic", () => ({
  default: () =>
    function StubJsonView({ data }: { data: unknown }) {
      return <pre data-testid="payload-json">{JSON.stringify(data)}</pre>;
    },
}));

vi.mock("@shared/casl/AbilityProvider", () => ({
  useAbility: () => ({ can: () => true }),
}));

const routerPush = vi.fn();
vi.mock("next/navigation", () => ({
  useRouter: () => ({ push: routerPush, replace: vi.fn() }),
  usePathname: () => "/admin/traces",
}));

const fetchMock = vi.fn();

beforeEach(() => {
  vi.stubGlobal("fetch", fetchMock as unknown as typeof fetch);
  toastSuccess.mockReset();
  toastError.mockReset();
  routerPush.mockReset();
});

afterEach(() => {
  fetchMock.mockReset();
  vi.unstubAllGlobals();
});

function wrapperWith(client: QueryClient) {
  return function Wrapper({ children }: { children: React.ReactNode }) {
    return <QueryClientProvider client={client}>{children}</QueryClientProvider>;
  };
}

function newClient() {
  return new QueryClient({
    defaultOptions: { queries: { retry: false }, mutations: { retry: false } },
  });
}

async function renderModal() {
  const { TraceRetryModal } = await import("../components/TraceRetryModal");
  const onClose = vi.fn();
  const client = newClient();
  const utils = render(
    <TraceRetryModal
      trace={amieFailedFixture.trace as Trace}
      spans={amieFailedFixture.spans as Span[]}
      open
      onClose={onClose}
    />,
    { wrapper: wrapperWith(client) },
  );
  return { onClose, client, ...utils };
}

describe("TraceRetryModal", () => {
  it("calls the mutation on 202 success, fires the success toast, and closes", async () => {
    fetchMock.mockResolvedValueOnce(new Response(null, { status: 202 }));
    const { onClose } = await renderModal();

    fireEvent.click(await screen.findByRole("button", { name: /Retry this flow/i }));

    await waitFor(() => {
      expect(toastSuccess).toHaveBeenCalled();
      expect(onClose).toHaveBeenCalled();
    });
    const message = toastSuccess.mock.calls[0]?.[0];
    expect(String(message)).toMatch(/Retry queued/i);
    const opts = toastSuccess.mock.calls[0]?.[1] as
      | { action?: { label: string; onClick: () => void } }
      | undefined;
    // The action invokes router.push (replacing the old window.location flow)
    // so the deep-link stays inside the SPA.
    opts?.action?.onClick();
    expect(routerPush).toHaveBeenCalledWith(
      `/admin/traces/${encodeURIComponent(amieFailedFixture.trace.trace_id)}`,
    );
    expect(opts?.action?.label).toMatch(/View trace/i);
  });

  it("on 409 shows an error toast with the body message and keeps the modal open", async () => {
    fetchMock.mockResolvedValueOnce(
      new Response(JSON.stringify({ error: "source http not registered for retry" }), {
        status: 409,
        headers: { "content-type": "application/json" },
      }),
    );
    const { onClose } = await renderModal();

    fireEvent.click(await screen.findByRole("button", { name: /Retry this flow/i }));

    await waitFor(() => expect(toastError).toHaveBeenCalled());
    expect(toastError.mock.calls[0]?.[0]).toMatch(/source http not registered/i);
    expect(onClose).not.toHaveBeenCalled();
    expect(await screen.findByRole("alert")).toHaveTextContent(/Last attempt failed/i);
  });

  it("on 422 shows the 'recorded before payload capture' error", async () => {
    fetchMock.mockResolvedValueOnce(
      new Response(
        JSON.stringify({
          error:
            "AMIE retry requires the original packet payload; this trace was recorded before payload capture was active",
        }),
        { status: 422, headers: { "content-type": "application/json" } },
      ),
    );
    const { onClose } = await renderModal();

    fireEvent.click(await screen.findByRole("button", { name: /Retry this flow/i }));

    await waitFor(() => expect(toastError).toHaveBeenCalled());
    expect(toastError.mock.calls[0]?.[0]).toMatch(/recorded before payload capture/i);
    expect(onClose).not.toHaveBeenCalled();
  });

  it("on 5xx renders a toast with a 'Retry the retry' action", async () => {
    fetchMock.mockResolvedValueOnce(
      new Response(JSON.stringify({ error: "boom" }), {
        status: 503,
        headers: { "content-type": "application/json" },
      }),
    );
    await renderModal();

    fireEvent.click(await screen.findByRole("button", { name: /Retry this flow/i }));

    await waitFor(() => expect(toastError).toHaveBeenCalled());
    const [msg, opts] = toastError.mock.calls[0] ?? [];
    expect(String(msg)).toMatch(/Retry failed.*backend/i);
    expect((opts as { action?: { label: string } } | undefined)?.action?.label).toMatch(
      /Retry the retry/i,
    );
  });

  it("on 5xx followed by a second 5xx, 'Retry the retry' surfaces another toast", async () => {
    fetchMock
      .mockResolvedValueOnce(
        new Response(JSON.stringify({ error: "boom" }), {
          status: 503,
          headers: { "content-type": "application/json" },
        }),
      )
      .mockResolvedValueOnce(
        new Response(JSON.stringify({ error: "still down" }), {
          status: 503,
          headers: { "content-type": "application/json" },
        }),
      );
    await renderModal();

    fireEvent.click(await screen.findByRole("button", { name: /Retry this flow/i }));
    await waitFor(() => expect(toastError).toHaveBeenCalledTimes(1));

    const opts = toastError.mock.calls[0]?.[1] as
      | { action?: { onClick: () => void } }
      | undefined;
    opts?.action?.onClick();

    await waitFor(() => expect(toastError).toHaveBeenCalledTimes(2));
    expect(String(toastError.mock.calls[1]?.[0])).toMatch(/Retry failed.*backend/i);
  });

  // §11.3 status matrix — the remaining error rows that don't share a
  // toast/UI nuance with 409/422/5xx. Each row asserts the canonical toast
  // copy when the backend body has no `error` field (fallback path).
  const fallbackRows: Array<{ status: number; expected: RegExp }> = [
    { status: 400, expected: /^Invalid trace ID\.$/ },
    { status: 404, expected: /^Trace no longer exists\.$/ },
    {
      status: 410,
      expected: /^The original packet for this trace has been purged and cannot be retried\.$/,
    },
  ];
  for (const { status, expected } of fallbackRows) {
    it(`on ${status} shows the spec-required fallback copy`, async () => {
      fetchMock.mockResolvedValueOnce(
        new Response(JSON.stringify({ error: "" }), {
          status,
          headers: { "content-type": "application/json" },
        }),
      );
      await renderModal();
      fireEvent.click(await screen.findByRole("button", { name: /Retry this flow/i }));
      await waitFor(() => expect(toastError).toHaveBeenCalled());
      expect(toastError.mock.calls[0]?.[0]).toMatch(expected);
    });
  }

  it("on 409 without a body.error falls back to source-interpolated copy", async () => {
    fetchMock.mockResolvedValueOnce(
      new Response(JSON.stringify({ error: "" }), {
        status: 409,
        headers: { "content-type": "application/json" },
      }),
    );
    await renderModal();
    fireEvent.click(await screen.findByRole("button", { name: /Retry this flow/i }));
    await waitFor(() => expect(toastError).toHaveBeenCalled());
    // amieFailedFixture.trace.source === "amie".
    expect(toastError.mock.calls[0]?.[0]).toBe(
      "Retry is not supported for traces from amie. Contact the developer who owns it.",
    );
  });

  it("Cancel calls onClose without calling the mutation", async () => {
    const { onClose } = await renderModal();
    fireEvent.click(screen.getByRole("button", { name: /^Cancel$/ }));
    expect(onClose).toHaveBeenCalled();
    expect(fetchMock).not.toHaveBeenCalled();
  });
});
