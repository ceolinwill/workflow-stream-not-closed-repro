import { getRun } from "workflow/api";

export async function GET(_request: Request, { params }: { params: Promise<{ runId: string }> }) {
  const { runId } = await params;

  return new Response(getRun(runId).getReadable<string>(), {
    headers: { "Content-Type": "text/plain" },
  });
}
