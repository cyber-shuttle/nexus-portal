import { beforeEach, describe, expect, it, vi } from "vitest";
import { fetchSystemRole } from "../systemRole";

const BASE_URL = "http://core.test";

describe("fetchSystemRole", () => {
  const fetchSpy = vi.spyOn(globalThis, "fetch");

  beforeEach(() => {
    fetchSpy.mockReset();
  });

  function mockResponse(body: unknown, init: ResponseInit = {}) {
    fetchSpy.mockResolvedValueOnce(
      new Response(typeof body === "string" ? body : JSON.stringify(body), {
        status: 200,
        headers: { "content-type": "application/json" },
        ...init,
      }),
    );
  }

  it("returns { role: 'admin' } when the API reports an active grant", async () => {
    mockResponse({ role: "admin" });
    const out = await fetchSystemRole("user-1", BASE_URL);
    expect(out).toEqual({ role: "admin" });
  });

  it("returns { role: null } when the API reports no grant", async () => {
    mockResponse({ role: null });
    const out = await fetchSystemRole("user-1", BASE_URL);
    expect(out).toEqual({ role: null });
  });

  it("sends the X-Custos-User-Id header and hits /me/system-role under the base URL", async () => {
    mockResponse({ role: null });
    await fetchSystemRole("person-abc", BASE_URL);
    expect(fetchSpy).toHaveBeenCalledTimes(1);
    const [url, init] = fetchSpy.mock.calls[0] as [string, RequestInit];
    expect(url).toBe("http://core.test/me/system-role");
    const headers = init.headers as Record<string, string>;
    expect(headers["X-Custos-User-Id"]).toBe("person-abc");
    expect(init.method).toBe("GET");
    expect(init.signal).toBeDefined();
  });

  it("throws with status when the API returns 401", async () => {
    mockResponse({}, { status: 401 });
    await expect(fetchSystemRole("user-1", BASE_URL)).rejects.toThrow(/401/);
  });

  it("throws with status when the API returns 503 (fail-closed signal)", async () => {
    mockResponse({}, { status: 503 });
    await expect(fetchSystemRole("user-1", BASE_URL)).rejects.toThrow(/503/);
  });

  it("throws with status on a generic 5xx", async () => {
    mockResponse({}, { status: 500 });
    await expect(fetchSystemRole("user-1", BASE_URL)).rejects.toThrow(/500/);
  });

  it("throws with status on a generic 4xx other than 401", async () => {
    mockResponse({}, { status: 418 });
    await expect(fetchSystemRole("user-1", BASE_URL)).rejects.toThrow(/418/);
  });

  it("throws when the body is not JSON", async () => {
    fetchSpy.mockResolvedValueOnce(
      new Response("<html>oops</html>", {
        status: 200,
        headers: { "content-type": "text/html" },
      }),
    );
    await expect(fetchSystemRole("user-1", BASE_URL)).rejects.toThrow(/not JSON/);
  });

  it("throws when role is an unknown string (contract violation)", async () => {
    mockResponse({ role: "superuser" });
    await expect(fetchSystemRole("user-1", BASE_URL)).rejects.toThrow(/violates contract/);
  });

  it("throws when role is the wrong type (contract violation)", async () => {
    mockResponse({ role: 42 });
    await expect(fetchSystemRole("user-1", BASE_URL)).rejects.toThrow(/violates contract/);
  });

  it("throws when the role key is missing entirely on a 200 response", async () => {
    mockResponse({});
    await expect(fetchSystemRole("user-1", BASE_URL)).rejects.toThrow(/violates contract/);
  });

  it("throws when the underlying fetch rejects (network failure)", async () => {
    fetchSpy.mockRejectedValueOnce(new Error("network down"));
    await expect(fetchSystemRole("user-1", BASE_URL)).rejects.toThrow(/network down/);
  });

  it("throws when the abort signal fires (timeout)", async () => {
    const abortErr = new DOMException("timed out", "TimeoutError");
    fetchSpy.mockRejectedValueOnce(abortErr);
    await expect(fetchSystemRole("user-1", BASE_URL)).rejects.toThrow(/timed out/);
  });
});
