# Workflow SDK Stream Not Closed on Run Completion Reproduction

Minimal reproduction for a run's stream staying open after the run completes. The [streaming docs](https://useworkflow.dev/docs/foundations/streaming) say "Streams are automatically closed when the workflow run completes", but a reader of a completed run's stream never sees the end unless the workflow called `getWritable().close()` itself. A route that returns `getRun(runId).getReadable()` keeps its response open until the client gives up or, on Vercel, until the function's maximum duration. Reported in https://github.com/vercel/workflow/issues/964.

## Reproduction

```sh
npm install
npm run repro
```

`npm run repro` starts `next dev` on port 3456 (local world), then for each of the two workflows in `workflows/stream.ts` it starts a run, waits until `getRun(runId).status` is `completed`, and reads `GET /api/runs/{runId}/stream` (which returns `getRun(runId).getReadable()`) for up to 15 seconds. Both workflows write one chunk and return. Only the second one closes the stream before returning. The script exits with code 1:

```txt
FAIL writeThenComplete (no close): run completed, read "hello\n", stream still open after 15000 ms
ok   writeCloseThenComplete (explicit close): run completed, read "hello\n", stream ended after 21 ms

A completed run's stream never ends unless the workflow closes it.
```

## Expected Behavior

Once the run is `completed` (or `failed` or `cancelled`), its streams are closed, so both reads end right after delivering `hello\n`, as the docs say.

## Actual Behavior

Nothing closes a run's streams when the run ends. In `@workflow/core` the only `world.streams.close` calls are an explicit `writer.close()` ([`serialization.ts`](https://github.com/vercel/workflow/blob/d9bcbf62d39a61eac070ca67111b90c425e04d05/packages/core/src/serialization.ts#L1671)), abort streams, and test helpers; writing `run_completed` in [`runtime.ts`](https://github.com/vercel/workflow/blob/d9bcbf62d39a61eac070ca67111b90c425e04d05/packages/core/src/runtime.ts#L3528) doesn't touch streams. The reader, [`createReconnectingFramedStream`](https://github.com/vercel/workflow/blob/d9bcbf62d39a61eac070ca67111b90c425e04d05/packages/core/src/serialization.ts#L990-L994), only treats the stream as finished when `streams.getInfo()` reports `done`, and the local world's [`streams.get`](https://github.com/vercel/workflow/blob/d9bcbf62d39a61eac070ca67111b90c425e04d05/packages/world-local/src/streamer.ts#L651) only ends a read at the EOF marker that `close()` writes, so the read waits for chunks that can never come.

## Environment

- workflow: `5.2.3` (`@workflow/core` `5.2.3`, `@workflow/world-local` `5.1.2`)
- Next.js: `16.4.3` (Turbopack, `next dev`)
- React: `19.3.1`
- Node.js: `24.22.0`
- npm: `11.19.1`
- macOS: `27.2`
