import { describe, expect, it, vi } from "vitest";
import { POST as audit } from "../app/api/audit/route";
import { POST as forkRun } from "../app/api/v1/runs/[runId]/fork/route";
import type { AuditResponse, AuditStreamMessage } from "../lib/types";

const auditRequest = {
  content: "const sql = `select * from users where id = ${id}`;",
  inputType: "files" as const,
  provider: "mock" as const,
  intensity: "quick" as const,
  rules: ["security", "testing"] as const,
};

async function createParent() {
  vi.stubEnv("DATABASE_URL", "");
  const response = await audit(
    new Request("http://localhost/api/audit", {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify(auditRequest),
    }),
  );
  return await response.json() as AuditResponse;
}

function parseStream(text: string) {
  return text
    .split("\n")
    .filter((line) => line.startsWith("data: "))
    .map((line) => JSON.parse(line.slice(6)) as AuditStreamMessage);
}

describe("POST /api/v1/runs/:runId/fork", () => {
  it("creates an immutable child run from the model checkpoint", async () => {
    const parent = await createParent();
    const parentSnapshot = structuredClone(parent.trace);
    const target = parent.trace.spans.find((span) => span.name === "provider-inspection")!;

    const response = await forkRun(
      new Request(`http://localhost/api/v1/runs/${parent.id}/fork`, {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({
          targetSpanId: target.id,
          request: auditRequest,
          parentProjection: parent.trace,
        }),
      }),
      { params: Promise.resolve({ runId: parent.id }) },
    );
    const messages = parseStream(await response.text());
    const resultMessage = messages.find(
      (message): message is Extract<AuditStreamMessage, { type: "result" }> =>
        message.type === "result",
    );
    const child = resultMessage?.result;

    expect(response.status).toBe(200);
    expect(child).toBeDefined();
    expect(child?.id).not.toBe(parent.id);
    expect(child?.trace.run).toMatchObject({
      parentRunId: parent.id,
      forkedFromSpanId: target.id,
      taskInputHash: parent.trace.run.taskInputHash,
    });
    expect(child?.trace.spans.some((span) => span.name === "checkpoint-restore")).toBe(true);
    expect(child?.trace.spans.some((span) => span.kind === "plan")).toBe(false);
    expect(parent.trace).toEqual(parentSnapshot);
  });

  it("rejects changed task input before execution", async () => {
    const parent = await createParent();
    const target = parent.trace.spans.find((span) => span.name === "provider-inspection")!;

    const response = await forkRun(
      new Request(`http://localhost/api/v1/runs/${parent.id}/fork`, {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({
          targetSpanId: target.id,
          request: { ...auditRequest, content: "const changed = true;" },
          parentProjection: parent.trace,
        }),
      }),
      { params: Promise.resolve({ runId: parent.id }) },
    );

    expect(response.status).toBe(409);
    expect(await response.json()).toMatchObject({
      error: "Fork input does not match the parent task input.",
    });
  });
});
