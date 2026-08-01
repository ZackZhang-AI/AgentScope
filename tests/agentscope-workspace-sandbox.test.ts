import { describe, expect, it } from "vitest";
import {
  FileWorkspaceSandbox,
  DockerScenarioTestRunner,
  MemoryArtifactStore,
  buggyAuthApiScenario,
  type ScenarioTestRunner,
} from "../lib/agentscope/execution";

const runner: ScenarioTestRunner = {
  async run(workspaceRoot) {
    const source = await import("node:fs/promises").then(({ readFile }) =>
      readFile(`${workspaceRoot}/src/auth.ts`, "utf8"),
    );
    const passed = source.includes('session.role === "admin"');
    return {
      passed,
      exitCode: passed ? 0 : 1,
      output: passed ? "auth policy tests passed" : "Admin test failed",
      timedOut: false,
    };
  },
};

describe("code-fix workspace sandbox", () => {
  it("blocks path traversal and changes outside the manifest", async () => {
    const workspace = await FileWorkspaceSandbox.create(
      buggyAuthApiScenario,
      runner,
    );
    try {
      const traversal = await workspace.execute({
        type: "tool",
        tool: "read_file",
        input: { path: "../package.json" },
        rationale: "Attempt an out-of-scope read.",
      });
      const testPatch = await workspace.execute({
        type: "tool",
        tool: "apply_patch",
        input: {
          path: "src/auth.test.ts",
          search: "Admin test failed",
          replacement: "ignored",
        },
        rationale: "Attempt to weaken the test.",
      });

      expect(traversal.error?.code).toBe("WORKSPACE_PATH_BLOCKED");
      expect(testPatch.error?.code).toBe("PATCH_PATH_BLOCKED");
    } finally {
      await workspace.dispose();
    }
  });

  it("executes a scoped patch and produces test and diff artifacts", async () => {
    const workspace = await FileWorkspaceSandbox.create(
      buggyAuthApiScenario,
      runner,
    );
    try {
      const patch = await workspace.execute({
        type: "tool",
        tool: "apply_patch",
        input: {
          path: "src/auth.ts",
          search: "return session.userId === targetUserId;",
          replacement:
            'return session.role === "admin" || session.userId === targetUserId;',
        },
        rationale: "Repair the authorization check.",
      });
      const test = await workspace.execute({
        type: "tool",
        tool: "run_tests",
        input: {},
        rationale: "Verify the repair.",
      });

      expect(patch.status).toBe("success");
      expect(patch.artifact?.mediaType).toBe("text/x-diff");
      expect(test.status).toBe("success");
      expect(test.artifact?.content).toContain("passed");
    } finally {
      await workspace.dispose();
    }
  });
});

describe.skipIf(process.env.TEST_DOCKER_SANDBOX !== "1")(
  "Docker scenario sandbox",
  () => {
    it("executes the fixed test command without network or write access", async () => {
      const workspace = await FileWorkspaceSandbox.create(
        buggyAuthApiScenario,
        new DockerScenarioTestRunner(),
      );
      try {
        const failed = await workspace.execute({
          type: "tool",
          tool: "run_tests",
          input: {},
          rationale: "Confirm the original authorization failure.",
        });
        await workspace.execute({
          type: "tool",
          tool: "apply_patch",
          input: {
            path: "src/auth.ts",
            search: "return session.userId === targetUserId;",
            replacement:
              'return session.role === "admin" || session.userId === targetUserId;',
          },
          rationale: "Repair the authorization check.",
        });
        const passed = await workspace.execute({
          type: "tool",
          tool: "run_tests",
          input: {},
          rationale: "Verify the repaired authorization behavior.",
        });

        expect(failed.error?.code).toBe("TEST_FAILED");
        expect(passed.status).toBe("success");
      } finally {
        await workspace.dispose();
      }
    }, 60_000);
  },
);

describe("artifact safety", () => {
  it("redacts secrets and enforces the per-artifact limit", async () => {
    const store = new MemoryArtifactStore();
    const artifact = await store.put({
      runId: "run_1",
      kind: "text",
      mediaType: "text/plain",
      name: "test log",
      content: "Authorization: Bearer abcdefghijklmnopqrstuvwxyz",
    });

    expect(artifact.redactionState).toBe("redacted");
    expect(artifact.content).not.toContain("abcdefghijklmnopqrstuvwxyz");

    await expect(
      store.put({
        runId: "run_1",
        kind: "text",
        mediaType: "text/plain",
        name: "oversized",
        content: "x".repeat(256 * 1024 + 1),
      }),
    ).rejects.toMatchObject({ code: "ARTIFACT_SIZE_LIMIT_EXCEEDED" });
  });
});
