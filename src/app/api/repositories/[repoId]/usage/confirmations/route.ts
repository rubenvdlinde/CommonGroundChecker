import { proxyToBackend } from "@/lib/backendProxy";

export const runtime = "nodejs";

export async function POST(request: Request, context: { params: Promise<{ repoId: string }> }) {
  const { repoId } = await context.params;
  return proxyToBackend(request, `/api/repositories/${encodeURIComponent(repoId)}/usage/confirmations`, "POST");
}

/** Removes one confirmation; the id is the `id` query parameter, so the proxy needs one dynamic segment only. */
export async function DELETE(request: Request, context: { params: Promise<{ repoId: string }> }) {
  const { repoId } = await context.params;
  const id = new URL(request.url).searchParams.get("id") ?? "";
  if (!id) {
    return new Response(JSON.stringify({ error: "Missing id query parameter." }), {
      status: 400,
      headers: { "content-type": "application/json" },
    });
  }
  return proxyToBackend(
    request,
    `/api/repositories/${encodeURIComponent(repoId)}/usage/confirmations/${encodeURIComponent(id)}`,
    "DELETE"
  );
}
