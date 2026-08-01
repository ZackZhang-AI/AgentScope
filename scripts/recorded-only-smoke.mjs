const baseUrl = process.env.BASE_URL ?? "http://127.0.0.1:3101";

async function waitForServer() {
  const deadline = Date.now() + 30_000;
  while (Date.now() < deadline) {
    try {
      const response = await fetch(baseUrl);
      if (response.ok) return;
    } catch {
      // The production server may still be booting.
    }
    await new Promise((resolve) => setTimeout(resolve, 250));
  }
  throw new Error(`Timed out waiting for ${baseUrl}.`);
}

async function expectStatus(path, expectedStatus) {
  const response = await fetch(`${baseUrl}${path}`);
  if (response.status !== expectedStatus) {
    throw new Error(`${path} returned ${response.status}, expected ${expectedStatus}.`);
  }
  return response;
}

await waitForServer();

for (const path of [
  "/",
  "/demos/code-fix-loop",
  "/case-study",
  "/audit",
  "/zh",
  "/zh/demos/code-fix-loop",
  "/zh/case-study",
  "/zh/audit",
]) {
  await expectStatus(path, 200);
}

const englishPrefix = await fetch(`${baseUrl}/en/demos/code-fix-loop`, {
  redirect: "manual",
});
if (![307, 308].includes(englishPrefix.status)) {
  throw new Error(`/en redirect returned ${englishPrefix.status}, expected 307 or 308.`);
}

const capabilities = await (await expectStatus(
  "/api/v1/system/capabilities",
  200,
)).json();
if (
  capabilities.executionProfile !== "recorded_only" ||
  capabilities.sandbox.available !== false
) {
  throw new Error("Public capabilities did not fail closed to recorded_only.");
}

const sandboxResponse = await fetch(`${baseUrl}/api/v1/runs`, {
  method: "POST",
  headers: { "content-type": "application/json" },
  body: JSON.stringify({
    taskType: "code_fix",
    scenarioId: "buggy-auth-api",
    executionMode: "sandbox",
    decisionProvider: "fixture",
  }),
});
const sandboxPayload = await sandboxResponse.json();
if (sandboxResponse.status !== 503 || sandboxPayload.code !== "SANDBOX_DISABLED") {
  throw new Error("Sandbox request was not rejected with SANDBOX_DISABLED.");
}

const demo = await (await expectStatus("/api/v1/code-fix-demo", 200)).json();
const artifacts = [...demo.parent.artifacts, ...demo.child.artifacts];
if (artifacts.length === 0) throw new Error("Recorded demo returned no artifacts.");
await expectStatus(`/api/v1/artifacts/${encodeURIComponent(artifacts[0].id)}`, 200);

console.log("Recorded-only smoke passed: pages, capabilities, sandbox rejection and artifacts.");
