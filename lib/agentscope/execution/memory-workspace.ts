import { createHash } from "node:crypto";
import type {
  ToolAction,
  ToolExecutionResult,
  WorkspaceSandbox,
} from "./contracts";
import type { CodeFixScenario } from "./scenario";

function digest(value: unknown) {
  return createHash("sha256")
    .update(JSON.stringify(value))
    .digest("hex")
    .slice(0, 16);
}

export class MemoryCodeFixWorkspace implements WorkspaceSandbox {
  readonly #files: Record<string, string>;

  constructor(
    private readonly scenario: CodeFixScenario,
    initialFiles: Readonly<Record<string, string>> = scenario.files,
  ) {
    this.#files = { ...initialFiles };
  }

  async execute(action: ToolAction): Promise<ToolExecutionResult> {
    const startedAt = Date.now();
    if (action.tool === "read_file") {
      const content = this.#files[action.input.path];
      return this.result(
        action.tool,
        content === undefined ? "error" : "success",
        content === undefined
          ? { blocked: true }
          : { path: action.input.path, content },
        startedAt,
        content === undefined
          ? {
              code: "WORKSPACE_FILE_NOT_FOUND",
              message: "The file is not part of the recorded scenario.",
              retryable: false,
            }
          : undefined,
      );
    }
    if (action.tool === "search_code") {
      const matches = Object.entries(this.#files)
        .filter(([path]) => !action.input.path || path.startsWith(action.input.path))
        .flatMap(([path, content]) =>
          content
            .split("\n")
            .map((line, index) => ({ line, index }))
            .filter(({ line }) => line.includes(action.input.query))
            .map(({ line, index }) => `${path}:${index + 1}:${line.trim()}`),
        );
      return this.result(
        action.tool,
        "success",
        { query: action.input.query, matches },
        startedAt,
      );
    }
    if (action.tool === "apply_patch") {
      if (!this.scenario.allowedFiles.includes(action.input.path)) {
        return this.result(
          action.tool,
          "error",
          { blocked: true },
          startedAt,
          {
            code: "PATCH_PATH_BLOCKED",
            message: "The file is outside the recorded patch allowlist.",
            retryable: false,
          },
        );
      }
      const before = this.#files[action.input.path] ?? "";
      const occurrences = before.split(action.input.search).length - 1;
      if (occurrences !== 1) {
        return this.result(
          action.tool,
          "error",
          { changed: false },
          startedAt,
          {
            code: "PATCH_ANCHOR_INVALID",
            message: `Patch anchor matched ${occurrences} times.`,
            retryable: false,
          },
        );
      }
      const after = before.replace(action.input.search, action.input.replacement);
      this.#files[action.input.path] = after;
      return this.result(
        action.tool,
        "success",
        { path: action.input.path, changed: before !== after },
        startedAt,
        undefined,
        {
          kind: "diff",
          mediaType: "text/x-diff",
          name: "auth.ts patch",
          content: [
            `--- a/${action.input.path}`,
            `+++ b/${action.input.path}`,
            `- ${action.input.search}`,
            `+ ${action.input.replacement}`,
          ].join("\n"),
        },
      );
    }
    const passed = this.#files["src/auth.ts"]?.includes(
      'session.role === "admin"',
    );
    return this.result(
      action.tool,
      passed ? "success" : "error",
      { passed: Boolean(passed), exitCode: passed ? 0 : 1, timedOut: false },
      startedAt,
      passed
        ? undefined
        : {
            code: "TEST_FAILED",
            message: "Admins must be allowed to delete another user.",
            retryable: true,
          },
      {
        kind: "text",
        mediaType: "text/plain",
        name: "Scenario test output",
        content: passed
          ? "auth policy tests passed"
          : "Error: Admins must be allowed to delete another user.",
      },
    );
  }

  async snapshot() {
    const files = { ...this.#files };
    const hash = digest(files);
    return { ref: `workspace://${hash}`, hash, files };
  }

  async dispose() {}

  private async result(
    tool: ToolAction["tool"],
    status: ToolExecutionResult["status"],
    output: ToolExecutionResult["output"],
    startedAt: number,
    error?: ToolExecutionResult["error"],
    artifact?: ToolExecutionResult["artifact"],
  ): Promise<ToolExecutionResult> {
    const workspaceHash = (await this.snapshot()).hash;
    return {
      tool,
      status,
      output,
      durationMs: Math.max(1, Date.now() - startedAt),
      workspaceHash,
      progressHash: digest({ workspaceHash, output }),
      error,
      artifact,
    };
  }
}
