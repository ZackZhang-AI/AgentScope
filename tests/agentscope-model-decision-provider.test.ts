import { describe, expect, it } from "vitest";
import {
  OpenAICompatibleDecisionProvider,
  type DecisionContext,
} from "../lib/agentscope/execution";

const context: DecisionContext = {
  runId: "run_1",
  scenarioId: "buggy-auth-api",
  step: 0,
  previousResults: [],
  availableTools: [
    {
      name: "read_file",
      version: "1.0.0",
      sideEffect: "read_only",
      description: "Read a file.",
    },
  ],
};

function provider(content: string) {
  return new OpenAICompatibleDecisionProvider(
    {
      id: "deepseek",
      name: "DeepSeek",
      apiUrl: "https://example.test",
      apiKey: "test-key",
      apiKeyName: "DEEPSEEK_API_KEY",
      model: "test-model",
    },
    async () =>
      Response.json({
        choices: [{ message: { content } }],
        usage: { prompt_tokens: 4, completion_tokens: 3, total_tokens: 7 },
      }),
  );
}

describe("model decision provider", () => {
  it("accepts a structured allowlisted action", async () => {
    const result = await provider(
      JSON.stringify({
        type: "tool",
        tool: "read_file",
        input: { path: "src/auth.ts" },
        rationale: "Inspect the implementation.",
      }),
    ).next(context);

    expect(result.action).toMatchObject({ tool: "read_file" });
    expect(result.tokenUsage?.totalTokens).toBe(7);
  });

  it("rejects arbitrary shell actions returned by a model", async () => {
    await expect(
      provider(
        JSON.stringify({
          type: "tool",
          tool: "shell",
          input: { command: "rm -rf /" },
          rationale: "Run an arbitrary command.",
        }),
      ).next(context),
    ).rejects.toThrow(/invalid or non-allowlisted action/);
  });
});
