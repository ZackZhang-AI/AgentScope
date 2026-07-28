import { afterEach, describe, expect, it, vi } from "vitest";
import { runDeepSeekAudit } from "../lib/providers/deepseek";

const validPayload = {
  summary: "DeepSeek found one issue.",
  riskScore: 61,
  findings: [
    {
      severity: "medium",
      category: "testing",
      title: "Missing regression test",
      evidence: "No test assertion accompanies the change.",
      recommendation: "Add a targeted regression test before merge.",
    },
  ],
};

describe("runDeepSeekAudit", () => {
  afterEach(() => {
    vi.unstubAllEnvs();
    vi.unstubAllGlobals();
  });

  it("extracts valid JSON when the model wraps it in text", async () => {
    vi.stubEnv("DEEPSEEK_API_KEY", "test-key");
    vi.stubGlobal(
      "fetch",
      vi.fn(async () =>
        new Response(
          JSON.stringify({
            choices: [
              {
                message: {
                  content: `Here is the result:\n${JSON.stringify(validPayload)}`,
                },
              },
            ],
          }),
          { status: 200 },
        ),
      ),
    );

    const result = await runDeepSeekAudit({
      content: "const ok = true;",
      inputType: "files",
      provider: "deepseek",
      intensity: "quick",
      rules: ["security", "testing"],
    });

    expect(result.model).toBe("deepseek-v4-flash");
    expect(result.summary).toBe("DeepSeek found one issue.");
    expect(result.findings).toHaveLength(1);
  });

  it("throws a provider response error for non-json model content", async () => {
    vi.stubEnv("DEEPSEEK_API_KEY", "test-key");
    vi.stubGlobal(
      "fetch",
      vi.fn(async () =>
        new Response(
          JSON.stringify({
            choices: [{ message: { content: "not json" } }],
          }),
          { status: 200 },
        ),
      ),
    );

    await expect(
      runDeepSeekAudit({
        content: "const ok = true;",
        inputType: "files",
        provider: "deepseek",
        intensity: "quick",
        rules: ["security"],
      }),
    ).rejects.toThrow(/valid JSON/);
  });
});
