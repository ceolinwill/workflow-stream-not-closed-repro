import { start } from "workflow/api";
import { writeCloseThenComplete, writeThenComplete } from "@/workflows/stream";

export async function POST(request: Request) {
  const close = new URL(request.url).searchParams.get("close") === "1";
  const run = await start(close ? writeCloseThenComplete : writeThenComplete);

  return Response.json({ runId: run.runId });
}
