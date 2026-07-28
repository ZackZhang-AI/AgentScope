import type { AuditRequest } from "../types";
import { runOpenAICompatibleAudit } from "./openai-compatible";

const MINIMAX_API_URL = "https://api.minimax.io/v1/chat/completions";

export function runMiniMaxAudit(request: AuditRequest) {
  return runOpenAICompatibleAudit(request, {
    name: "MiniMax",
    apiUrl: MINIMAX_API_URL,
    apiKey: process.env.MINIMAX_API_KEY,
    apiKeyName: "MINIMAX_API_KEY",
    model: process.env.MINIMAX_MODEL || "MiniMax-M2.7",
  });
}
