import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import { PUT } from "@/app/api/repositories/[repoId]/follow/route";

const originalFetch = globalThis.fetch;

describe("Repository follow proxy route", () => {
  beforeEach(() => {
    vi.stubGlobal("fetch", vi.fn());
  });

  afterEach(() => {
    vi.stubGlobal("fetch", originalFetch);
    vi.restoreAllMocks();
  });

  it("forwards the follow settings and the admin bearer token to the backend", async () => {
    const fetchMock = globalThis.fetch as unknown as ReturnType<typeof vi.fn>;
    fetchMock.mockResolvedValueOnce(
      new Response(JSON.stringify({ id: "repo-id", followed: true }), {
        status: 200,
        headers: { "content-type": "application/json" },
      })
    );

    const response = await PUT(
      new Request("http://localhost/api/repositories/repo-id/follow", {
        method: "PUT",
        headers: { "content-type": "application/json", authorization: "Bearer admin" },
        body: JSON.stringify({ followed: true, checkIntervalHours: 24 }),
      }),
      { params: Promise.resolve({ repoId: "repo-id" }) }
    );

    expect(response.status).toBe(200);
    const [url, init] = fetchMock.mock.calls[0] as [string, RequestInit];
    expect(url).toMatch(/\/api\/repositories\/repo-id\/follow$/);
    expect(init.method).toBe("PUT");
    expect((init.headers as Record<string, string>).Authorization).toBe("Bearer admin");
    expect(JSON.parse(init.body as string)).toEqual({ followed: true, checkIntervalHours: 24 });
  });

  it("passes the backend status through", async () => {
    const fetchMock = globalThis.fetch as unknown as ReturnType<typeof vi.fn>;
    fetchMock.mockResolvedValueOnce(
      new Response(JSON.stringify({ error: "Missing or invalid admin token." }), {
        status: 401,
        headers: { "content-type": "application/json" },
      })
    );

    const response = await PUT(
      new Request("http://localhost/api/repositories/repo-id/follow", {
        method: "PUT",
        body: JSON.stringify({ followed: true }),
      }),
      { params: Promise.resolve({ repoId: "repo-id" }) }
    );

    expect(response.status).toBe(401);
    const [, init] = fetchMock.mock.calls[0] as [string, RequestInit];
    expect((init.headers as Record<string, string>).Authorization).toBeUndefined();
  });
});
