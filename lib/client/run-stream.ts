import type { RunStreamMessage } from "../agentscope/execution";

export type RunStreamCursor = {
  runId?: string;
  lastSequence: number;
  resultReceived: boolean;
  errorReceived: boolean;
};

function deliver(
  block: string,
  onMessage: (message: RunStreamMessage) => void,
  cursor: RunStreamCursor,
) {
  const data = block
    .split(/\r?\n/)
    .filter((line) => line.startsWith("data:"))
    .map((line) => line.slice(5).trimStart())
    .join("\n");
  if (!data) return;
  const message = JSON.parse(data) as RunStreamMessage;
  onMessage(message);
  if (message.type === "trace_event") {
    cursor.runId = message.event.runId;
    cursor.lastSequence = Math.max(cursor.lastSequence, message.event.sequence);
  } else if (message.type === "result") {
    cursor.resultReceived = true;
  } else if (message.type === "error") {
    cursor.errorReceived = true;
  }
}

export async function consumeRunStream(
  response: Response,
  onMessage: (message: RunStreamMessage) => void,
) {
  if (!response.body) throw new Error("Run response did not include a stream.");
  const reader = response.body.getReader();
  const decoder = new TextDecoder();
  const cursor: RunStreamCursor = {
    lastSequence: 0,
    resultReceived: false,
    errorReceived: false,
  };
  let buffer = "";
  while (true) {
    const { value, done } = await reader.read();
    buffer += decoder.decode(value, { stream: !done });
    const blocks = buffer.split(/\r?\n\r?\n/);
    buffer = blocks.pop() ?? "";
    blocks.forEach((block) => deliver(block, onMessage, cursor));
    if (done) {
      if (buffer.trim()) deliver(buffer, onMessage, cursor);
      return cursor;
    }
  }
}
