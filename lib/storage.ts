import type { AuditResponse } from "./types";

const STORAGE_KEY = "harnesslab.sessions.v2";
const MAX_SESSIONS = 6;

export function loadSessions(): AuditResponse[] {
  if (typeof window === "undefined") return [];

  try {
    const raw = window.localStorage.getItem(STORAGE_KEY);
    if (!raw) return [];
    const parsed = JSON.parse(raw);
    return Array.isArray(parsed) ? parsed : [];
  } catch {
    return [];
  }
}

export function saveSession(session: AuditResponse) {
  if (typeof window === "undefined") return;

  try {
    const sessions = loadSessions().filter((item) => item.id !== session.id);
    window.localStorage.setItem(
      STORAGE_KEY,
      JSON.stringify([session, ...sessions].slice(0, MAX_SESSIONS)),
    );
  } catch {
    // Browsers may block localStorage in private contexts. The app still works without history.
  }
}

export function clearSessions() {
  if (typeof window === "undefined") return;

  try {
    window.localStorage.removeItem(STORAGE_KEY);
  } catch {
    // Ignore storage failures.
  }
}
