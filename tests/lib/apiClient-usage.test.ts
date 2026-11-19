import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import { deleteSla } from "@/lib/apiClient";

const originalFetch = globalThis.fetch;

function fetchMock() {
  return globalThis.fetch as unknown as ReturnType<typeof vi.fn>;
}

describe("SLA removal", () => {
  beforeEach(() => {
    vi.stubGlobal("fetch", vi.fn());
    vi.spyOn(console, "log").mockImplementation(() => undefined);
  });

  afterEach(() => {
    vi.stubGlobal("fetch", originalFetch);
    vi.restoreAllMocks();
  });

  it("removes an SLA through the proxy with the id as a query parameter and the token", async () => {
    fetchMock().mockResolvedValueOnce(new Response(JSON.stringify({ slas: [] }), { status: 200 }));

    const status = await deleteSla("repo id", "s/1", "secret");

    expect(status).toEqual({ slas: [] });
    const [url, init] = fetchMock().mock.calls[0] as [string, RequestInit];
    expect(url).toBe("/api/repositories/repo%20id/usage/slas?id=s%2F1");
    expect(init.method).toBe("DELETE");
    expect((init.headers as Record<string, string>).Authorization).toBe("Bearer secret");
  });

  it("throws the status and body of a failed removal", async () => {
    fetchMock().mockResolvedValueOnce(
      new Response(JSON.stringify({ error: "SLA not found." }), { status: 404 })
    );

    await expect(deleteSla("repo-id", "s1", "secret")).rejects.toMatchObject({
      status: 404,
      body: { error: "SLA not found." },
    });
    expect((fetchMock().mock.calls[0] as [string])[0]).toBe("/api/repositories/repo-id/usage/slas?id=s1");
  });
});
