import { expect, test, type Page } from "@playwright/test";

async function openWorkbench(page: Page) {
  await page.goto("/");
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
  await page.getByLabel("Provider").selectOption("deepseek");
  await expect(page.getByText("DeepSeek requires DEEPSEEK_API_KEY on the server.")).toBeVisible();
  await page.getByLabel("Provider").selectOption("minimax");
  await expect(page.getByText("MiniMax requires MINIMAX_API_KEY on the server.")).toBeVisible();
  await page.getByLabel("Provider").selectOption("mock");
  await page.getByRole("button", { name: "Run Audit" }).click();
  await expect(
    page.getByRole("heading", { name: "Missing authorization boundary", exact: true }),
  ).toBeVisible({ timeout: 20_000 });

  await page.reload();
  await expect(page.getByRole("button", { name: /Missing authorization boundary/ })).toBeVisible();
});

test("mobile layout keeps primary controls visible", async ({ page }) => {
  await openWorkbench(page);

  await expect(page.getByRole("heading", { name: "AgentScope" })).toBeVisible();
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
