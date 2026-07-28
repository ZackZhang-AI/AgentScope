import type { AuditStreamMessage } from "../types";

export async function consumeAuditStream(
  response: Response,
  onMessage: (message: AuditStreamMessage) => void,
) {
  if (!response.body) {
    throw new Error("The audit response did not include a stream.");
  }

  const reader = response.body.getReader();
  const decoder = new TextDecoder();
  let buffer = "";

  while (true) {
    const { value, done } = await reader.read();
    buffer += decoder.decode(value, { stream: !done });
    const blocks = buffer.split("\n\n");
    buffer = blocks.pop() ?? "";

    for (const block of blocks) {
      const data = block
        .split("\n")
        .find((line) => line.startsWith("data: "))
        ?.slice(6);
      if (data) onMessage(JSON.parse(data) as AuditStreamMessage);
    }

    if (done) break;
  }
}
