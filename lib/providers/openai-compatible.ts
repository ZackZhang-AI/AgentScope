import { z } from "zod";
import { auditResponsePayloadSchema } from "../schemas";
import type {
  AuditRequest,
  ProviderAuditResult,
  TokenUsage,
} from "../types";
import {
  ProviderConfigurationError,
  ProviderResponseError,
  ProviderTimeoutError,
} from "./errors";
import { extractJsonObject, normalizeProviderPayload } from "./normalize";

type OpenAICompatibleProviderConfig = {
  name: "DeepSeek" | "MiniMax";
  apiUrl: string;
  apiKey?: string;
  apiKeyName: string;
  model: string;
};

function systemPrompt(request: AuditRequest) {
  return `You are HarnessLab, a code audit agent inside an observable harness.

Review the submitted ${request.inputType} using only these enabled rules:
${request.rules.map((rule) => `- ${rule}`).join("\n")}

Do not return generic advice. Every finding must cite concrete evidence and a
specific recommendation. Return JSON only. The harness, not the model, owns
trace events, quality evaluation, and report generation.`;
}

function userPrompt(request: AuditRequest) {
  return `Audit intensity: ${request.intensity}

Code:
${request.content}

Return exactly:
{
  "summary": "...",
  "riskScore": 0,
  "findings": [
    {
      "severity": "critical | high | medium | low | info",
      "file": "optional",
      "line": 1,
      "title": "...",
      "evidence": "...",
      "recommendation": "...",
      "category": "security | reliability | maintainability | testing | performance"
    }
  ]
}`;
}

function readTokenUsage(value: unknown): TokenUsage | undefined {
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

export async function runOpenAICompatibleAudit(
  request: AuditRequest,
  config: OpenAICompatibleProviderConfig,
): Promise<ProviderAuditResult> {
  if (!config.apiKey) {
    throw new ProviderConfigurationError(
      `Missing ${config.apiKeyName}. Switch to Mock Demo or configure the server environment.`,
    );
  }

  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), 25000);
  const startedAt = Date.now();
  let response: Response;

  try {
    response = await fetch(config.apiUrl, {
      method: "POST",
      signal: controller.signal,
      headers: {
        "content-type": "application/json",
        authorization: `Bearer ${config.apiKey}`,
      },
      body: JSON.stringify({
        model: config.model,
        response_format: { type: "json_object" },
        messages: [
          { role: "system", content: systemPrompt(request) },
          { role: "user", content: userPrompt(request) },
        ],
        temperature: request.intensity === "quick" ? 0.1 : 0.2,
      }),
    });
  } catch (error) {
    if (error instanceof Error && error.name === "AbortError") {
      throw new ProviderTimeoutError(`${config.name} request timed out.`);
    }
    throw error;
  } finally {
    clearTimeout(timeout);
  }

  if (!response.ok) {
    throw new ProviderResponseError(
      `${config.name} returned ${response.status}: ${await response.text()}`,
    );
  }

  const json = await response.json();
  const content = json?.choices?.[0]?.message?.content;
  if (typeof content !== "string") {
    throw new ProviderResponseError(
      `${config.name} response did not include message content.`,
    );
  }

  let rawPayload: unknown;
  try {
    rawPayload = JSON.parse(content);
  } catch {
    const extracted = extractJsonObject(content);
    if (!extracted) {
      throw new ProviderResponseError(
        `${config.name} response was not valid JSON.`,
      );
    }
    rawPayload = JSON.parse(extracted);
  }

  try {
    auditResponsePayloadSchema.parse(rawPayload);
  } catch (error) {
    if (error instanceof z.ZodError) {
      throw new ProviderResponseError(
        `${config.name} JSON failed schema validation: ${
          error.issues[0]?.message ?? "unknown issue"
        }`,
      );
    }
    throw error;
  }

  return normalizeProviderPayload(
    rawPayload,
    config.model,
    Date.now() - startedAt,
    readTokenUsage(json?.usage),
  );
}
