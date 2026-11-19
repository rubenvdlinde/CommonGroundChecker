import { proxyToBackend } from "@/lib/backendProxy";

export const runtime = "nodejs";

export async function PUT(request: Request, context: { params: Promise<{ repoId: string }> }) {
  const { repoId } = await context.params;
  return proxyToBackend(request, `/api/repositories/${encodeURIComponent(repoId)}/retire`, "PUT");
}
