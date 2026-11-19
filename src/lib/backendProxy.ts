const remoteApiBaseUrl = process.env.URL?.replace(/\/$/, "") || "http://localhost:3000";

/** Forwards a request with its JSON body and bearer token to the backend and passes the status and body back. */
export async function proxyToBackend(request: Request, path: string, method: string): Promise<Response> {
  const headers: Record<string, string> = { Accept: "application/json" };
  const authorization = request.headers.get("authorization");
  if (authorization) headers.Authorization = authorization;

  const body = method === "GET" || method === "DELETE" ? undefined : await request.text();
  if (body !== undefined) headers["content-type"] = "application/json";

  const response = await fetch(`${remoteApiBaseUrl}${path}`, { method, headers, body });
  return new Response(await response.text(), {
    status: response.status,
    headers: { "content-type": response.headers.get("content-type") ?? "application/json" },
  });
}
