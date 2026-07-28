import type { AuditRequest } from "../types";
import { runOpenAICompatibleAudit } from "./openai-compatible";

const DEEPSEEK_API_URL = "https://api.deepseek.com/chat/completions";

export function runDeepSeekAudit(request: AuditRequest) {
  return runOpenAICompatibleAudit(request, {
    name: "DeepSeek",
    apiUrl: DEEPSEEK_API_URL,
    apiKey: process.env.DEEPSEEK_API_KEY,
    apiKeyName: "DEEPSEEK_API_KEY",
    model: process.env.DEEPSEEK_MODEL || "deepseek-v4-flash",
  });
}

export {
  ProviderConfigurationError,
  ProviderResponseError,
  ProviderTimeoutError,
} from "./errors";
