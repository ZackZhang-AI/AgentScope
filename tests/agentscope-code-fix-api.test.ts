import { beforeEach, describe, expect, it } from "vitest";
import { GET as getDemo } from "../app/api/v1/code-fix-demo/route";
import { POST as createRun } from "../app/api/v1/runs/route";
import { GET as getArtifact } from "../app/api/v1/artifacts/[artifactId]/route";
import { resolveCapabilities } from "../app/api/v1/system/capabilities/route";
import { POST as forkRun } from "../app/api/v1/runs/[runId]/forks/route";
import {
  reserveIdempotentRun,
  resetIdempotencyForTests,
} from "../lib/agentscope/execution";

describe("code-fix portfolio APIs", () => {
  beforeEach(() => resetIdempotencyForTests());

  it("serves a deterministic failure-to-fix recorded demo without a key", async () => {
    const response = await getDemo();
    const demo = await response.json();

    expect(demo.kind).toBe("agentscope.code-fix-demo");
    expect(demo.parent.result.trace.run.status).toBe("error");
    expect(demo.child.result.trace.run).toMatchObject({
      status: "success",
      parentRunId: demo.parent.result.id,
    });
    expect(demo.diagnostics).toEqual(
      expect.arrayContaining([
        expect.objectContaining({ ruleId: "no-progress-loop" }),
      ]),
    );
  });

  it("routes recorded creation requests to the permanent demo", async () => {
    const response = await createRun(
      new Request("http://localhost/api/v1/runs", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({
          taskType: "code_fix",
          scenarioId: "buggy-auth-api",
          executionMode: "recorded",
          decisionProvider: "fixture",
        }),
      }),
    );

    expect(response.status).toBe(200);
    await expect(response.json()).resolves.toMatchObject({
      code: "RECORDED_DEMO_AVAILABLE",
      demoUrl: "/demos/code-fix-loop",
    });
  });

  it("serves only user-visible recorded artifacts", async () => {
    const demo = await (await getDemo()).json();
    const artifactId = demo.parent.artifacts[0].id as string;
    const response = await getArtifact(
      new Request(`http://localhost/api/v1/artifacts/${artifactId}`),
      { params: Promise.resolve({ artifactId }) },
    );

    expect(response.status).toBe(200);
    await expect(response.json()).resolves.toMatchObject({
      artifact: { id: artifactId, visibility: "user" },
    });
  });

  it("maps the same idempotency key to one stable run", () => {
    const first = reserveIdempotentRun("run", "portfolio-demo", "request-a");
    const second = reserveIdempotentRun("run", "portfolio-demo", "request-a");

    expect(first.duplicate).toBe(false);
    expect(second).toEqual({ runId: first.runId, duplicate: true });
  });

  it("fails closed without probing Docker in recorded-only deployments", async () => {
    let dockerChecks = 0;
    const capabilities = await resolveCapabilities(
      {
        AGENTSCOPE_EXECUTION_PROFILE: "recorded_only",
        DATABASE_URL: "postgresql://configured-but-disabled",
        DEEPSEEK_API_KEY: "configured-but-disabled",
      },
      async () => {
        dockerChecks += 1;
        return true;
      },
    );

    expect(dockerChecks).toBe(0);
    expect(capabilities).toMatchObject({
      executionProfile: "recorded_only",
      sandbox: { available: false, docker: false },
      providers: {
        fixture: { available: false },
        deepseek: { available: false },
        minimax: { available: false },
      },
    });
  });

  it("rejects sandbox creation and forks with a stable deployment error", async () => {
    const previous = process.env.AGENTSCOPE_EXECUTION_PROFILE;
    process.env.AGENTSCOPE_EXECUTION_PROFILE = "recorded_only";
    try {
      const runResponse = await createRun(
        new Request("http://localhost/api/v1/runs", {
          method: "POST",
          headers: { "content-type": "application/json" },
          body: JSON.stringify({
            taskType: "code_fix",
            scenarioId: "buggy-auth-api",
            executionMode: "sandbox",
            decisionProvider: "fixture",
          }),
        }),
      );
      const forkResponse = await forkRun(
        new Request("http://localhost/api/v1/runs/parent/forks", {
          method: "POST",
          headers: { "content-type": "application/json" },
          body: JSON.stringify({ targetSpanId: "span" }),
        }),
        { params: Promise.resolve({ runId: "parent" }) },
      );

      expect(runResponse.status).toBe(503);
      expect(forkResponse.status).toBe(503);
      await expect(runResponse.json()).resolves.toMatchObject({
        code: "SANDBOX_DISABLED",
      });
      await expect(forkResponse.json()).resolves.toMatchObject({
        code: "SANDBOX_DISABLED",
      });
    } finally {
      if (previous === undefined) {
        delete process.env.AGENTSCOPE_EXECUTION_PROFILE;
      } else {
        process.env.AGENTSCOPE_EXECUTION_PROFILE = previous;
      }
    }
  });
});
