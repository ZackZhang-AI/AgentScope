import { expect, test, type Page } from "@playwright/test";
import successfulFixture from "../fixtures/agentscope/successful-code-audit.json";
import {
  projectTraceEvents,
  traceFixtureSchema,
} from "../lib/agentscope/domain";
import { createRunBundle } from "../lib/agentscope/transfer/run-bundle";

async function openWorkbench(page: Page) {
  await page.goto("/audit");
  await expect(page.locator("main[data-hydrated='true']")).toBeVisible();
}

test("sample audit flow shows trace, findings, and exports", async ({ page }) => {
  await openWorkbench(page);

  await page.getByRole("button", { name: "SQL injection risk" }).click();
  await expect(page.getByLabel("Code input")).toHaveValue(/select \* from users/);
  await page.getByRole("button", { name: "Run Audit" }).click();

  await expect(
    page.getByRole("heading", {
      name: "Possible SQL injection through string-built query",
      exact: true,
    }),
  ).toBeVisible();
  await expect(page.getByText("Harness Trace")).toBeVisible();
  await expect(page.getByRole("button", { name: "Restart visual replay" })).toBeEnabled();
  await page.getByRole("button", { name: "Restart visual replay" }).click();
  await expect(page.getByText("No structured trace yet")).toBeVisible();
  await page.getByRole("button", { name: "Next event" }).click();
  await expect(page.getByText(/Event 1\/\d+: run.created/)).toBeVisible();
  await page.getByRole("button", { name: "Play visual replay" }).click();
  await expect(page.getByText("Diagnostics", { exact: true })).toBeVisible({ timeout: 15_000 });
  await page.getByRole("treeitem").filter({ hasText: "provider-inspection" }).click();
  await page.getByRole("tab", { name: "Replay" }).click();
  await page.getByRole("button", { name: "Fork from this step" }).click();
  await expect(page.getByRole("dialog", { name: "Replay preflight" })).toBeVisible();
  await expect(page.getByText("Ready to create a child run")).toBeVisible();
  await page.getByRole("button", { name: "Create child run" }).click();
  await expect(
    page.getByRole("treeitem").filter({ hasText: "checkpoint-restore" }),
  ).toBeVisible({ timeout: 20_000 });
  await expect(page.getByRole("button", { name: "Run Compare" })).toBeVisible();
  await expect(page.getByText("Parent vs child facts")).toBeVisible();
  await page.getByRole("button", { name: "Eval Report" }).click();
  await expect(page.getByText("Deterministic rule scores")).toBeVisible();
  const evalDownload = page.waitForEvent("download");
  await page.getByRole("button", { name: "Export Eval JSON" }).click();
  await expect((await evalDownload).suggestedFilename()).toMatch(/agentscope-eval-.*\.json$/);
  await expect(page.getByText("Risk Score", { exact: true })).toBeVisible();
  const markdownDownload = page.waitForEvent("download");
  await page.getByRole("button", { name: "Export Markdown" }).click();
  await expect((await markdownDownload).suggestedFilename()).toMatch(/\.md$/);

  const jsonDownload = page.waitForEvent("download");
  await page.getByRole("button", { name: "Export JSON" }).click();
  await expect((await jsonDownload).suggestedFilename()).toMatch(/\.json$/);
  await expect(page.getByRole("button", { name: "Copy PR Comment" })).toBeEnabled();
});

test("provider switching and session restore remain usable", async ({ page }) => {
  await openWorkbench(page);

  await page.getByRole("button", { name: "React auth bug" }).click();
  await page.getByLabel("Provider", { exact: true }).selectOption("deepseek");
  await expect(page.getByText("DeepSeek requires DEEPSEEK_API_KEY on the server.")).toBeVisible();
  await page.getByLabel("Provider", { exact: true }).selectOption("minimax");
  await expect(page.getByText("MiniMax requires MINIMAX_API_KEY on the server.")).toBeVisible();
  await page.getByLabel("Provider", { exact: true }).selectOption("mock");
  await page.getByRole("button", { name: "Run Audit" }).click();
  await expect(
    page.getByRole("heading", { name: "Missing authorization boundary", exact: true }),
  ).toBeVisible({ timeout: 20_000 });

  await page.reload();
  await expect(page.getByRole("button", { name: /Missing authorization boundary/ })).toBeVisible();
});

test("mobile layout keeps primary controls visible", async ({ page }) => {
  await openWorkbench(page);

  await expect(page.getByText("AgentScope", { exact: true })).toBeVisible();
  await expect(page.getByRole("button", { name: "Run Audit" })).toBeVisible();
  await expect(page.getByLabel("Code input")).toBeVisible();
});

test("public pull request import fills the diff input", async ({ page }) => {
  await page.route("**/api/github/pr", async (route) => {
    await route.fulfill({
      status: 200,
      contentType: "application/json",
      body: JSON.stringify({
        content: "diff --git a/app.ts b/app.ts\n+const imported = true;",
        inputType: "diff",
        source: {
          kind: "github-pr",
          url: "https://github.com/acme/repo/pull/42",
        },
      }),
    });
  });
  await openWorkbench(page);

  await page
    .getByLabel("Public GitHub PR")
    .fill("https://github.com/acme/repo/pull/42");
  await page.getByRole("button", { name: "Import pull request" }).click();

  await expect(page.getByLabel("Code input")).toHaveValue(/imported = true/);
  await expect(page.getByText(/Imported from https:\/\/github.com/)).toBeVisible();
});

test("offline fixtures cover failure, replay, and comparison without execution requests", async ({ page }) => {
  let executionRequests = 0;
  page.on("request", (request) => {
    const path = new URL(request.url()).pathname;
    if (path === "/api/audit" || /\/api\/v1\/runs\/.+\/fork$/.test(path)) {
      executionRequests += 1;
    }
  });
  await openWorkbench(page);

  await page.getByRole("button", { name: /Successful trace/ }).click();
  await expect(page.getByText("run_success_001", { exact: true })).toBeVisible();

  await page.getByRole("button", { name: /Repeated tool failure/ }).click();
  await expect(page.getByText("run_failure_001", { exact: true })).toBeVisible();
  await expect(page.getByText("3 duplicate tool calls")).toBeVisible();
  await page.getByRole("tab", { name: "Replay" }).click();
  await page.getByRole("button", { name: "Fork from this step" }).click();
  await expect(page.getByText("Ready for deterministic Fixture Replay")).toBeVisible();
  await page.getByRole("button", { name: "Replay fixed fixture" }).click();

  await expect(page.getByText("run_fork_001", { exact: true })).toBeVisible();
  await expect(page.getByRole("button", { name: "Run Compare" })).toBeVisible();
  await expect(page.getByText("Parent vs child facts")).toBeVisible();
  expect(executionRequests).toBe(0);

  await page.getByRole("button", { name: /Fork recovery compare/ }).click();
  await expect(page.getByText("run_fork_001", { exact: true })).toBeVisible();
  await expect(page.getByText("Parent vs child facts")).toBeVisible();
  await page
    .getByRole("button", {
      name: "parent",
      exact: true,
      description: "run_failure_001",
    })
    .click();
  await expect(page.getByText("run_failure_001", { exact: true })).toBeVisible();
});

test("trace tree filters, keyboard navigation, replay seek, and timeline zoom remain synchronized", async ({ page }) => {
  await openWorkbench(page);
  await page.getByRole("button", { name: /Successful trace/ }).click();
  await expect(page.getByText("run_success_001", { exact: true })).toBeVisible();

  const treeItems = page.getByRole("treeitem");
  await expect(treeItems).toHaveCount(5);
  await page.getByRole("button", { name: "Collapse code-audit-agent" }).click();
  await expect(treeItems).toHaveCount(1);
  await page.getByRole("button", { name: "Expand code-audit-agent" }).click();

  await page.getByLabel("Filter by span kind").selectOption("tool");
  await expect(treeItems).toHaveCount(3);
  await page.getByLabel("Filter by span kind").selectOption("all");
  await page.getByPlaceholder("Filter spans").fill("final-answer");
  await expect(treeItems).toHaveCount(2);
  await page.getByPlaceholder("Filter spans").fill("");

  const modelRow = treeItems.filter({ hasText: "inspect-code" });
  await modelRow.click();
  await modelRow.press("ArrowRight");
  await expect(treeItems.filter({ hasText: "read_file" })).toHaveAttribute("aria-selected", "true");
  const overviewTab = page.getByRole("tab", { name: "Overview" });
  await overviewTab.focus();
  await overviewTab.press("End");
  await expect(page.getByRole("tab", { name: "Raw" })).toHaveAttribute("aria-selected", "true");
  await page.getByRole("tab", { name: "Raw" }).press("Home");
  await expect(overviewTab).toHaveAttribute("aria-selected", "true");

  await page.getByRole("button", { name: "Zoom timeline in" }).click();
  await expect(page.getByLabel("Pan timeline viewport")).toBeVisible();
  await page.getByLabel("Pan timeline viewport").fill("25");
  await page.getByRole("button", { name: "Fit entire timeline" }).click();
  await expect(page.getByLabel("Pan timeline viewport")).toHaveCount(0);

  await page.getByLabel("Seek visual replay event").fill("5");
  await expect(page.getByText(/Event 5\/15:/)).toBeVisible();
});

test("an interrupted audit stream resumes from its last persisted sequence", async ({ page }) => {
  const initialEvents = successfulFixture.events.filter(
    (event) => event.sequence <= 5,
  );
  const remainingEvents = successfulFixture.events.filter(
    (event) => event.sequence > 5,
  );
  const initialStream = initialEvents
    .map(
      (event) =>
        `id: ${event.sequence}\nevent: trace_event\ndata: ${JSON.stringify({
          type: "trace_event",
          event,
        })}\n\n`,
    )
    .join("");

  await page.route("**/api/audit", async (route) => {
    await route.fulfill({
      status: 200,
      headers: {
        "content-type": "text/event-stream; charset=utf-8",
        "x-agentscope-resumable": "true",
      },
      body: initialStream,
    });
  });
  await page.route(
    "**/api/v1/runs/run_success_001/events?after=5",
    async (route) => {
      await route.fulfill({
        status: 200,
        contentType: "application/json",
        body: JSON.stringify({ events: remainingEvents }),
      });
    },
  );
  await openWorkbench(page);

  await page.getByRole("button", { name: "Run Audit" }).click();

  await expect(
    page.getByText(/Trace run_success_001 was recovered through event 15/),
  ).toBeVisible();
  await expect(page.getByText("run_success_001", { exact: true })).toBeVisible();
  await expect(page.getByRole("treeitem")).toHaveCount(5);
});

test("run manager filters history and compares any two selected runs", async ({ page }) => {
  await openWorkbench(page);
  await page.getByRole("button", { name: /Successful trace/ }).click();
  await expect(page.getByText("run_success_001", { exact: true })).toBeVisible();
  await page.getByRole("button", { name: /Repeated tool failure/ }).click();
  await expect(page.getByText("run_failure_001", { exact: true })).toBeVisible();

  await page.getByPlaceholder("Filter runs").fill("Repeated tool failure");
  await expect(
    page.getByRole("button", { name: /Repeated tool failure exhausted retries/ }),
  ).toBeVisible();
  await page.getByPlaceholder("Filter runs").fill("");

  await page
    .getByRole("button", { name: "Select run_success_001 for compare" })
    .click();
  await page
    .getByRole("button", { name: "Select run_failure_001 for compare" })
    .click();
  await page.getByRole("button", { name: "Compare 2/2" }).click();

  await expect(page.getByRole("button", { name: "Run Compare" })).toBeVisible();
  await expect(page.getByText("Parent vs child facts")).toBeVisible();
  await expect(page.getByText(/unmatched/)).toBeVisible();
});

test("versioned run bundles export and import without executing the agent", async ({ page }) => {
  let executionRequests = 0;
  page.on("request", (request) => {
    if (new URL(request.url()).pathname === "/api/audit") executionRequests += 1;
  });
  await openWorkbench(page);
  await page.getByRole("button", { name: /Successful trace/ }).click();
  await expect(page.getByText("run_success_001", { exact: true })).toBeVisible();

  const download = page.waitForEvent("download");
  await page.getByRole("button", { name: "Export Run" }).click();
  await expect((await download).suggestedFilename()).toBe(
    "agentscope-run-run_success_001.json",
  );

  await page.getByRole("button", { name: "Reset input" }).click();
  const events = traceFixtureSchema.parse(successfulFixture).events;
  const bundle = createRunBundle(
    projectTraceEvents(events),
    events,
    "2026-07-28T12:00:00.000Z",
  );
  await page.getByLabel("Import AgentScope run JSON").setInputFiles({
    name: "run.json",
    mimeType: "application/json",
    buffer: Buffer.from(JSON.stringify(bundle)),
  });

  await expect(page.getByText("run_success_001", { exact: true })).toBeVisible();
  expect(executionRequests).toBe(0);
});
