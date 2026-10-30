import { getRun } from "workflow/api";

export async function GET(_request: Request, { params }: { params: Promise<{ runId: string }> }) {
  const { runId } = await params;

  return Response.json({ status: await getRun(runId).status });
}
