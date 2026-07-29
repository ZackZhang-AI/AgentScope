import { createHash } from "node:crypto";

export type CodeFixScenario = {
  id: "buggy-auth-api";
  name: string;
  objective: string;
  allowedFiles: readonly string[];
  testCommand: readonly string[];
  files: Readonly<Record<string, string>>;
};

const authSource = `export type Session = {
  userId: string;
  role: "user" | "admin";
};

export function canDeleteUser(session: Session, targetUserId: string) {
  return session.userId === targetUserId;
}
`;

const authTest = `import { canDeleteUser, type Session } from "./auth";

const admin: Session = { userId: "admin-1", role: "admin" };
const user: Session = { userId: "user-1", role: "user" };

if (!canDeleteUser(admin, "user-2")) {
  throw new Error("Admins must be allowed to delete another user.");
}

if (canDeleteUser(user, "user-2")) {
  throw new Error("Normal users must not delete another user.");
}

console.log("auth policy tests passed");
`;

export const buggyAuthApiScenario: CodeFixScenario = {
  id: "buggy-auth-api",
  name: "Buggy authorization API",
  objective:
    "Repair the authorization rule so admins can delete another user while normal users remain scoped to themselves.",
  allowedFiles: ["src/auth.ts"],
  testCommand: ["node", "--experimental-strip-types", "src/auth.test.ts"],
  files: {
    "src/auth.ts": authSource,
    "src/auth.test.ts": authTest,
  },
};

export function getCodeFixScenario(id: string) {
  return id === buggyAuthApiScenario.id ? buggyAuthApiScenario : null;
}

export function scenarioInputHash(scenario: CodeFixScenario) {
  return createHash("sha256")
    .update(JSON.stringify({ id: scenario.id, files: scenario.files }))
    .digest("hex")
    .slice(0, 16);
}
