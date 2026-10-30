import { getWritable } from "workflow";

async function writeMessage(message: string) {
  "use step";

  const writer = getWritable<string>().getWriter();
  await writer.write(message);
  writer.releaseLock();
}

async function closeStream() {
  "use step";

  await getWritable().close();
}

export async function writeThenComplete() {
  "use workflow";

  await writeMessage("hello\n");
  return "done";
}

export async function writeCloseThenComplete() {
  "use workflow";

  await writeMessage("hello\n");
  await closeStream();
  return "done";
}
