const remoteApiBaseUrl =
  process.env.URL?.replace(/\/$/, "") ||
  "http://localhost:3000";

function createRemoteUrl(path: string) {
  return `${remoteApiBaseUrl}${path}`;
}

export const runtime = "nodejs";

export async function PUT(
  request: Request,
  context: { params: Promise<{ repoId: string }> }
) {
  const { repoId } = await context.params;
  const url = createRemoteUrl(`/api/repositories/${encodeURIComponent(repoId)}/follow`);
  const headers: Record<string, string> = {
    "content-type": "application/json",
    Accept: "application/json",
  };
  const authorization = request.headers.get("authorization");
  if (authorization) {
    headers.Authorization = authorization;
  }

  const response = await fetch(url, {
    method: "PUT",
    headers,
    body: await request.text(),
  });

  const body = await response.text();
  return new Response(body, {
    status: response.status,
    headers: {
      "content-type": response.headers.get("content-type") ?? "application/json",
    },
  });
}
