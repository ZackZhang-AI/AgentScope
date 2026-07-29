import { z } from "zod";
import {
  ProviderConfigurationError,
  ProviderResponseError,
  ProviderTimeoutError,
} from "../../providers/errors";
import { extractJsonObject } from "../../providers/normalize";
import {
  agentActionSchema,
  type CodeFixRunRequest,
  type DecisionContext,
  type DecisionProvider,
  type DecisionResult,
} from "./contracts";
import { FixtureDecisionProvider } from "./fixture-decision-provider";

type ProviderConfig = {
  id: "deepseek" | "minimax";
  name: string;
  apiUrl: string;
  apiKey?: string;
  apiKeyName: string;
  model: string;
};

type Fetcher = typeof fetch;

function providerConfig(id: "deepseek" | "minimax"): ProviderConfig {
  if (id === "deepseek") {
    return {
      id,
      name: "DeepSeek",
      apiUrl: "https://api.deepseek.com/chat/completions",
      apiKey: process.env.DEEPSEEK_API_KEY,
      apiKeyName: "DEEPSEEK_API_KEY",
      model: process.env.DEEPSEEK_AGENT_MODEL || process.env.DEEPSEEK_MODEL || "deepseek-v4-flash",
    };
  }
  return {
    id,
    name: "MiniMax",
    apiUrl: "https://api.minimax.io/v1/chat/completions",
    apiKey: process.env.MINIMAX_API_KEY,
    apiKeyName: "MINIMAX_API_KEY",
    model: process.env.MINIMAX_AGENT_MODEL || process.env.MINIMAX_MODEL || "MiniMax-M2.7",
  };
}

function readUsage(value: unknown) {
  if (!value || typeof value !== "object") return undefined;
  const usage = value as Record<string, unknown>;
  const inputTokens =
    typeof usage.prompt_tokens === "number" ? usage.prompt_tokens : undefined;
  const outputTokens =
    typeof usage.completion_tokens === "number"
      ? usage.completion_tokens
      : undefined;
  const totalTokens =
    typeof usage.total_tokens === "number" ? usage.total_tokens : undefined;
  return inputTokens === undefined &&
    outputTokens === undefined &&
    totalTokens === undefined
    ? undefined
    : { inputTokens, outputTokens, totalTokens };
}

export class OpenAICompatibleDecisionProvider implements DecisionProvider {
  readonly id: "deepseek" | "minimax";

  constructor(
    private readonly config: ProviderConfig,
    private readonly fetcher: Fetcher = fetch,
  ) {
    this.id = config.id;
  }

  async next(context: DecisionContext): Promise<DecisionResult> {
    if (!this.config.apiKey) {
      throw new ProviderConfigurationError(
        `Missing ${this.config.apiKeyName}. Use Fixture decisions or configure the server environment.`,
      );
    }
    const startedAt = Date.now();
    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), 25_000);
    let response: Response;
    try {
      response = await this.fetcher(this.config.apiUrl, {
        method: "POST",
        signal: controller.signal,
        headers: {
          "content-type": "application/json",
          authorization: `Bearer ${this.config.apiKey}`,
        },
        body: JSON.stringify({
          model: this.config.model,
          response_format: { type: "json_object" },
          temperature: 0.1,
          messages: [
            {
              role: "system",
              content:
                "You are a code-repair decision policy. Select exactly one allowlisted action. Never emit shell commands, paths outside the provided scenario, or prose outside JSON.",
            },
            {
              role: "user",
              content: JSON.stringify({
                scenarioId: context.scenarioId,
                step: context.step,
                availableTools: context.availableTools,
                previousResults: context.previousResults.slice(-4),
                actionSchema:
                  "Return one of: tool(read_file|search_code|apply_patch|run_tests) with matching input and rationale, or finish with outcome and summary.",
              }),
            },
          ],
        }),
      });
    } catch (error) {
      if (error instanceof Error && error.name === "AbortError") {
        throw new ProviderTimeoutError(
          `${this.config.name} decision request timed out.`,
        );
      }
      throw error;
    } finally {
      clearTimeout(timeout);
    }

    if (!response.ok) {
      throw new ProviderResponseError(
        `${this.config.name} returned ${response.status}: ${await response.text()}`,
      );
    }
    const payload = await response.json();
    const content = payload?.choices?.[0]?.message?.content;
    if (typeof content !== "string") {
      throw new ProviderResponseError(
        `${this.config.name} decision response did not contain message content.`,
      );
    }
    const jsonText = extractJsonObject(content) ?? content;
    let rawAction: unknown;
    try {
      rawAction = JSON.parse(jsonText);
    } catch {
      throw new ProviderResponseError(
        `${this.config.name} decision was not valid JSON.`,
      );
    }
    try {
      return {
        action: agentActionSchema.parse(rawAction),
        model: this.config.model,
        durationMs: Date.now() - startedAt,
        tokenUsage: readUsage(payload?.usage),
      };
    } catch (error) {
      if (error instanceof z.ZodError) {
        throw new ProviderResponseError(
          `${this.config.name} selected an invalid or non-allowlisted action: ${error.issues[0]?.message ?? "schema mismatch"}.`,
        );
      }
      throw error;
    }
  }
}

export function createDecisionProvider(
  id: CodeFixRunRequest["decisionProvider"],
  fixtureProfile: "parent" | "repair" = "parent",
) {
  return id === "fixture"
    ? new FixtureDecisionProvider(fixtureProfile)
    : new OpenAICompatibleDecisionProvider(providerConfig(id));
}
