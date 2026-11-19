import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import { DELETE as DELETE_SLA, POST as POST_SLA } from "@/app/api/repositories/[repoId]/usage/slas/route";

const originalFetch = globalThis.fetch;

function fetchMock() {
  return globalThis.fetch as unknown as ReturnType<typeof vi.fn>;
}

function backendReply(status: number, body: unknown) {
  fetchMock().mockResolvedValueOnce(
    new Response(JSON.stringify(body), { status, headers: { "content-type": "application/json" } })
  );
}

describe("Repository usage proxy routes", () => {
  beforeEach(() => {
    vi.stubGlobal("fetch", vi.fn());
  });

  afterEach(() => {
    vi.stubGlobal("fetch", originalFetch);
    vi.restoreAllMocks();
  });

  it("passes the backend status through and leaves out a missing token", async () => {
    backendReply(401, { error: "Missing or invalid admin token." });

    const response = await DELETE_SLA(
      new Request("http://localhost/api/repositories/repo-id/usage/slas?id=s%2F1", { method: "DELETE" }),
      { params: Promise.resolve({ repoId: "repo-id" }) }
    );

    expect(response.status).toBe(401);
    const [url, init] = fetchMock().mock.calls[0] as [string, RequestInit];
    expect(url).toMatch(/\/usage\/slas\/s%2F1$/);
    expect(init.body).toBeUndefined();
    expect((init.headers as Record<string, string>).Authorization).toBeUndefined();
  });

  it("forwards an SLA and its removal", async () => {
    backendReply(201, {});
    backendReply(200, {});

    await POST_SLA(
      new Request("http://localhost/api/repositories/repo-id/usage/slas", {
        method: "POST",
        headers: { authorization: "Bearer admin" },
        body: JSON.stringify({ party: "VNG" }),
      }),
      { params: Promise.resolve({ repoId: "repo-id" }) }
    );
    const removed = await DELETE_SLA(
      new Request("http://localhost/api/repositories/repo-id/usage/slas?id=s1", {
        method: "DELETE",
        headers: { authorization: "Bearer admin" },
      }),
      { params: Promise.resolve({ repoId: "repo-id" }) }
    );

    expect(removed.status).toBe(200);
    const [, postInit] = fetchMock().mock.calls[0] as [string, RequestInit];
    expect((postInit.headers as Record<string, string>).Authorization).toBe("Bearer admin");
    expect(JSON.parse(postInit.body as string)).toEqual({ party: "VNG" });
    const urls = fetchMock().mock.calls.map((call) => (call as [string])[0]);
    expect(urls[0]).toMatch(/\/usage\/slas$/);
    expect(urls[1]).toMatch(/\/usage\/slas\/s1$/);
  });

  it("refuses a removal without an id", async () => {
    const response = await DELETE_SLA(
      new Request("http://localhost/api/repositories/repo-id/usage/slas", { method: "DELETE" }),
      { params: Promise.resolve({ repoId: "repo-id" }) }
    );

    expect(response.status).toBe(400);
    expect(fetchMock()).not.toHaveBeenCalled();
  });
});
