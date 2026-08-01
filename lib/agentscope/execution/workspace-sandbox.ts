import { createHash } from "node:crypto";
import {
  chmod,
  mkdir,
  mkdtemp,
  readFile,
  rm,
  writeFile,
} from "node:fs/promises";
import { tmpdir } from "node:os";
import { basename, dirname, isAbsolute, join, relative, sep } from "node:path";
import { spawn } from "node:child_process";
import type {
  ToolAction,
  ToolExecutionResult,
  WorkspaceSandbox,
} from "./contracts";
import type { CodeFixScenario } from "./scenario";

export type ScenarioTestResult = {
  passed: boolean;
  exitCode: number | null;
  output: string;
  timedOut: boolean;
};

export interface ScenarioTestRunner {
  run(workspaceRoot: string, scenario: CodeFixScenario): Promise<ScenarioTestResult>;
}

function digest(value: unknown) {
  return createHash("sha256")
    .update(JSON.stringify(value))
    .digest("hex")
    .slice(0, 16);
}

function safeRelativePath(path: string) {
  if (
    !path ||
    isAbsolute(path) ||
    path.includes("\0") ||
    path.split(/[\\/]/).includes("..")
  ) {
    throw new WorkspacePolicyError(
      "WORKSPACE_PATH_BLOCKED",
      `Workspace path ${JSON.stringify(path)} is not allowed.`,
    );
  }
  return path.replaceAll("\\", "/");
}

export class WorkspacePolicyError extends Error {
  constructor(
    readonly code: string,
    message: string,
  ) {
    super(message);
  }
}

export class DockerScenarioTestRunner implements ScenarioTestRunner {
  constructor(
    private readonly image = process.env.AGENTSCOPE_SANDBOX_IMAGE || "node:22-alpine",
    private readonly timeoutMs = 20_000,
  ) {}

  run(workspaceRoot: string, scenario: CodeFixScenario) {
    const volume = `${workspaceRoot}:/workspace:ro`;
    const args = [
      "run",
      "--rm",
      "--network",
      "none",
      "--cpus",
      "0.5",
      "--memory",
      "256m",
      "--pids-limit",
      "64",
      "--read-only",
      "--tmpfs",
      "/tmp:rw,noexec,nosuid,size=32m",
      "--user",
      "65532:65532",
      "--volume",
      volume,
      "--workdir",
      "/workspace",
      this.image,
      ...scenario.testCommand,
    ];
    return runProcess("docker", args, this.timeoutMs);
  }
}

export async function isDockerSandboxAvailable() {
  try {
    const result = await runProcess("docker", ["info", "--format", "{{.ServerVersion}}"], 3_000);
    return result.exitCode === 0 && !result.timedOut;
  } catch {
    return false;
  }
}

async function runProcess(
  executable: string,
  args: readonly string[],
  timeoutMs: number,
): Promise<ScenarioTestResult> {
  return new Promise((resolve, reject) => {
    const child = spawn(executable, [...args], {
      windowsHide: true,
      shell: false,
      stdio: ["ignore", "pipe", "pipe"],
    });
    let output = "";
    let timedOut = false;
    const timer = setTimeout(() => {
      timedOut = true;
      child.kill();
    }, timeoutMs);
    child.stdout.on("data", (chunk) => {
      output += String(chunk);
    });
    child.stderr.on("data", (chunk) => {
      output += String(chunk);
    });
    child.on("error", (error) => {
      clearTimeout(timer);
      reject(error);
    });
    child.on("close", (exitCode) => {
      clearTimeout(timer);
      resolve({
        passed: exitCode === 0 && !timedOut,
        exitCode,
        output: output.slice(0, 128 * 1024),
        timedOut,
      });
    });
  });
}

export class FileWorkspaceSandbox implements WorkspaceSandbox {
  private disposed = false;

  private constructor(
    private readonly root: string,
    private readonly scenario: CodeFixScenario,
    private readonly testRunner: ScenarioTestRunner,
  ) {}

  static async create(
    scenario: CodeFixScenario,
    testRunner: ScenarioTestRunner = new DockerScenarioTestRunner(),
    initialFiles: Readonly<Record<string, string>> = scenario.files,
  ) {
    const root = await mkdtemp(join(tmpdir(), "agentscope-codefix-"));
    // mkdtemp uses 0700 on Linux; the non-root test container needs read access
    // to the workspace that is mounted read-only.
    await chmod(root, 0o755);
    const workspace = new FileWorkspaceSandbox(root, scenario, testRunner);
    const expectedFiles = Object.keys(scenario.files).sort();
    const restoredFiles = Object.keys(initialFiles).sort();
    if (JSON.stringify(expectedFiles) !== JSON.stringify(restoredFiles)) {
      await workspace.dispose();
      throw new WorkspacePolicyError(
        "WORKSPACE_SNAPSHOT_INVALID",
        "Workspace snapshot files do not match the scenario manifest.",
      );
    }
    for (const [path, content] of Object.entries(initialFiles)) {
      if (Buffer.byteLength(content, "utf8") > 64 * 1024) {
        await workspace.dispose();
        throw new WorkspacePolicyError(
          "WORKSPACE_SNAPSHOT_INVALID",
          `Workspace snapshot file ${path} exceeds 64KB.`,
        );
      }
      const destination = workspace.resolveKnownPath(path);
      await mkdir(dirname(destination), { recursive: true });
      await writeFile(destination, content, "utf8");
      await chmod(destination, 0o644);
    }
    return workspace;
  }

  async execute(action: ToolAction): Promise<ToolExecutionResult> {
    this.assertActive();
    const startedAt = Date.now();
    try {
      if (action.tool === "read_file") {
        const path = safeRelativePath(action.input.path);
        const content = await readFile(this.resolveKnownPath(path), "utf8");
        return this.result(action.tool, "success", { path, content }, startedAt);
      }

      if (action.tool === "search_code") {
        const searchRoot = action.input.path
          ? safeRelativePath(action.input.path)
          : "";
        const matches: string[] = [];
        for (const path of Object.keys(this.scenario.files).sort()) {
          if (searchRoot && !path.startsWith(searchRoot)) continue;
          const content = await readFile(this.resolveKnownPath(path), "utf8");
          content.split("\n").forEach((line, index) => {
            if (line.includes(action.input.query)) {
              matches.push(`${path}:${index + 1}:${line.trim()}`);
            }
          });
        }
        return this.result(
          action.tool,
          "success",
          { query: action.input.query, matches },
          startedAt,
        );
      }

      if (action.tool === "apply_patch") {
        const path = safeRelativePath(action.input.path);
        if (!this.scenario.allowedFiles.includes(path)) {
          throw new WorkspacePolicyError(
            "PATCH_PATH_BLOCKED",
            `Patching ${path} is not allowed by the scenario manifest.`,
          );
        }
        const location = this.resolveKnownPath(path);
        const before = await readFile(location, "utf8");
        const occurrences = before.split(action.input.search).length - 1;
        if (occurrences !== 1) {
          throw new WorkspacePolicyError(
            "PATCH_ANCHOR_INVALID",
            `Patch search text must match exactly once; found ${occurrences}.`,
          );
        }
        const after = before.replace(action.input.search, action.input.replacement);
        if (Buffer.byteLength(after, "utf8") > 64 * 1024) {
          throw new WorkspacePolicyError(
            "PATCH_FILE_TOO_LARGE",
            "Patched source file exceeds the 64KB scenario limit.",
          );
        }
        await writeFile(location, after, "utf8");
        const diff = [
          `--- a/${path}`,
          `+++ b/${path}`,
          `- ${action.input.search}`,
          `+ ${action.input.replacement}`,
        ].join("\n");
        return this.result(
          action.tool,
          "success",
          { path, changed: before !== after },
          startedAt,
          undefined,
          {
            kind: "diff",
            mediaType: "text/x-diff",
            name: `${basename(path)} patch`,
            content: diff,
          },
        );
      }

      const test = await this.testRunner.run(this.root, this.scenario);
      return this.result(
        action.tool,
        test.passed ? "success" : "error",
        {
          passed: test.passed,
          exitCode: test.exitCode,
          timedOut: test.timedOut,
        },
        startedAt,
        test.passed
          ? undefined
          : {
              code: test.timedOut ? "TEST_TIMEOUT" : "TEST_FAILED",
              message: test.timedOut
                ? "Scenario tests exceeded the execution timeout."
                : "Scenario tests failed.",
              retryable: true,
            },
        {
          kind: "text",
          mediaType: "text/plain",
          name: "Scenario test output",
          content: test.output,
        },
      );
    } catch (error) {
      const policyError =
        error instanceof WorkspacePolicyError
          ? error
          : new WorkspacePolicyError(
              "WORKSPACE_TOOL_FAILED",
              error instanceof Error ? error.message : "Workspace tool failed.",
            );
      return this.result(
        action.tool,
        "error",
        { blocked: true },
        startedAt,
        {
          code: policyError.code,
          message: policyError.message,
          retryable: false,
        },
      );
    }
  }

  async snapshot() {
    this.assertActive();
    const files: Record<string, string> = {};
    for (const path of Object.keys(this.scenario.files).sort()) {
      files[path] = await readFile(this.resolveKnownPath(path), "utf8");
    }
    const hash = digest(files);
    return { ref: `workspace://${hash}`, hash, files };
  }

  async dispose() {
    if (this.disposed) return;
    const expectedPrefix = join(tmpdir(), "agentscope-codefix-");
    if (!this.root.startsWith(expectedPrefix)) {
      throw new Error("Refusing to remove a workspace outside the AgentScope temp root.");
    }
    await rm(this.root, { recursive: true, force: true });
    this.disposed = true;
  }

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
      durationMs: Math.max(0, Date.now() - startedAt),
      workspaceHash,
      progressHash: digest({ workspaceHash, output }),
      error,
      artifact,
    };
  }

  private resolveKnownPath(path: string) {
    const safe = safeRelativePath(path);
    if (!(safe in this.scenario.files)) {
      throw new WorkspacePolicyError(
        "WORKSPACE_FILE_NOT_FOUND",
        `File ${safe} is not part of the scenario.`,
      );
    }
    const resolved = join(this.root, ...safe.split("/"));
    const inside = relative(this.root, resolved);
    if (!inside || inside.startsWith(`..${sep}`) || isAbsolute(inside)) {
      throw new WorkspacePolicyError(
        "WORKSPACE_PATH_BLOCKED",
        `File ${safe} resolves outside the workspace.`,
      );
    }
    return resolved;
  }

  private assertActive() {
    if (this.disposed) throw new Error("Workspace has already been disposed.");
  }
}
