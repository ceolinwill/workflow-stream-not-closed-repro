import { spawn } from "node:child_process";
import { rm } from "node:fs/promises";

const PORT = 3456;
const BASE = `http://localhost:${PORT}`;
const READ_FOR_MS = 15_000;

async function waitForServer() {
  for (let attempt = 0; attempt < 120; attempt++) {
    const ok = await fetch(BASE).then(
      () => true,
      () => false,
    );

    if (ok) {
      return;
    }

    await new Promise((resolve) => setTimeout(resolve, 500));
  }

  throw new Error("next dev didn't start");
}

async function waitForCompleted(runId) {
  for (let attempt = 0; attempt < 120; attempt++) {
    const { status } = await fetch(`${BASE}/api/runs/${runId}`).then((response) => response.json());

    if (status === "completed") {
      return;
    }

    await new Promise((resolve) => setTimeout(resolve, 250));
  }

  throw new Error(`run ${runId} didn't complete`);
}

async function readStream(runId) {
  const startedAt = Date.now();
  const response = await fetch(`${BASE}/api/runs/${runId}/stream`, {
    signal: AbortSignal.timeout(READ_FOR_MS),
  });
  const reader = response.body.pipeThrough(new TextDecoderStream()).getReader();
  let text = "";

  try {
    for (;;) {
      const { done, value } = await reader.read();

      if (done) {
        return { ended: true, ms: Date.now() - startedAt, text };
      }

      text += value;
    }
  } catch (error) {
    if (error.name === "TimeoutError") {
      return { ended: false, ms: Date.now() - startedAt, text };
    }

    throw error;
  }
}

async function check(label, close) {
  const { runId } = await fetch(`${BASE}/api/start?close=${close ? 1 : 0}`, {
    method: "POST",
  }).then((response) => response.json());

  await waitForCompleted(runId);

  const { ended, ms, text } = await readStream(runId);
  const outcome = ended
    ? `stream ended after ${ms} ms`
    : `stream still open after ${READ_FOR_MS} ms`;

  console.log(`${ended ? "ok  " : "FAIL"} ${label}: run completed, read ${JSON.stringify(text)}, ${outcome}`);

  return ended;
}

await rm(".workflow-data", { force: true, recursive: true });

const server = spawn("npx", ["next", "dev", "--port", String(PORT)], {
  detached: true,
  stdio: "ignore",
});

try {
  await waitForServer();

  const results = [
    await check("writeThenComplete (no close)", false),
    await check("writeCloseThenComplete (explicit close)", true),
  ];

  if (results.includes(false)) {
    console.log("\nA completed run's stream never ends unless the workflow closes it.");
    process.exitCode = 1;
  }
} finally {
  process.kill(-server.pid);
}
