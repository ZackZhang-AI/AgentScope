import { expect, test } from "@playwright/test";

test.describe.configure({ mode: "serial" });

test("recorded code-fix story reaches an evidence-backed verified child", async ({
  page,
}) => {
  let sandboxExecutions = 0;
  page.on("request", (request) => {
    if (
      request.method() === "POST" &&
      new URL(request.url()).pathname === "/api/v1/runs"
    ) {
      sandboxExecutions += 1;
    }
  });

  await page.goto("/");
  await expect(page.locator("main[data-hydrated='true']")).toBeVisible();
  await page.getByRole("button", { name: "Start 90-second demo" }).click();

  await expect(page).toHaveURL(/\/demos\/code-fix-loop$/);
  await expect(
    page.getByRole("heading", {
      name: "Failure: the parent ends after repeating the same test",
    }),
  ).toBeVisible();
  await expect(
    page.getByRole("button", { name: /No-progress tool loop/ }),
  ).toBeVisible();

  await page.getByRole("button", { name: "Locate root cause" }).click();
  await page.getByRole("button", { name: "Inspect safe checkpoint" }).click();
  await page.getByRole("button", { name: "Fork from this step" }).click();
  await expect(
    page.getByText("Ready for deterministic Fixture Replay"),
  ).toBeVisible();
  await page.getByRole("button", { name: "Replay fixed fixture" }).click();

  await expect(
    page.getByRole("heading", {
      name: "The child removed the failure without mutating its parent",
    }),
  ).toBeVisible();
  await expect(page.getByText("Parent vs child facts")).toBeVisible();
  await expect(page.getByText("Resolved", { exact: true })).toBeVisible();
  await expect(page.getByText("Regressed", { exact: true })).toBeVisible();
  await expect(page.getByText("Trade-off", { exact: true })).toBeVisible();

  await page
    .getByRole("treeitem")
    .filter({ hasText: "apply_patch" })
    .click();
  await page.getByRole("tab", { name: "Artifacts" }).click();
  await expect(page.getByRole("button", { name: "diff" })).toBeVisible();
  await expect(page.getByText(/session\.role === "admin"/)).toBeVisible();

  await page.getByRole("button", { name: "Eval Report" }).click();
  await expect(page.getByText("Target tests", { exact: true })).toBeVisible();
  await expect(page.getByText("passed", { exact: true })).toBeVisible();
  expect(sandboxExecutions).toBe(0);
});

test("recorded demo restores from its permanent URL on mobile", async ({
  page,
}) => {
  await page.goto("/demos/code-fix-loop");
  await expect(page.locator("main[data-hydrated='true']")).toBeVisible();
  await expect(
    page.getByRole("heading", {
      name: "Failure: the parent ends after repeating the same test",
    }),
  ).toBeVisible();
  await expect(page.getByText("Failure", { exact: true })).toBeVisible();
  await expect(page.getByText("Root cause", { exact: true })).toBeVisible();
  await expect(page.getByRole("tab", { name: "Artifacts" })).toBeVisible();
});

test("Chinese demo completes the full story and preserves state when switching language", async ({ page }) => {
  await page.goto("/zh/demos/code-fix-loop");
  await expect(page.locator("html")).toHaveAttribute("lang", "zh-CN");
  await expect(page.getByRole("heading", { name: /Parent 在重复运行同一测试后结束/ })).toBeVisible();
  await expect(page.getByText("no_progress_loop", { exact: false })).toBeVisible();

  await page.getByRole("button", { name: "定位根因" }).click();
  await page.getByRole("button", { name: "检查安全 Checkpoint" }).click();
  await page.getByRole("button", { name: "从此步骤创建分支" }).click();
  await expect(page.getByText("可以执行确定性 Fixture Replay")).toBeVisible();
  await page.getByRole("button", { name: "回放固定 Fixture" }).click();

  await expect(page.getByRole("heading", { name: /Child 消除了失败/ })).toBeVisible();
  await expect(page.getByText("Parent 与 Child 实测事实")).toBeVisible();
  await page.getByRole("button", { name: "Eval 报告" }).click();
  await expect(page.getByText("确定性规则评分")).toBeVisible();
  await expect(page.getByText("run_tests", { exact: false })).toBeVisible();

  await page.evaluate(() => { window.location.hash = "span-tool-test-success"; });
  await page.getByRole("link", { name: "Switch to English" }).click();
  await expect(page).toHaveURL(/\/demos\/code-fix-loop\?view=verified#span-tool-test-success$/);
});

test("local sandbox executes tools, forks a child, and restores its run URL", async ({
  page,
}) => {
  test.skip(
    process.env.E2E_SANDBOX !== "1",
    "Set E2E_SANDBOX=1 with PostgreSQL and Docker to run the real sandbox flow.",
  );

  await page.goto("/");
  await expect(page.locator("main[data-hydrated='true']")).toBeVisible();
  const runButton = page.getByRole("button", { name: "Run sandbox agent" });
  await expect(runButton).toBeEnabled({ timeout: 20_000 });
  await runButton.click();

  await expect(
    page.getByRole("heading", {
      name: "Failure: the parent ends after repeating the same test",
    }),
  ).toBeVisible({ timeout: 45_000 });
  await page.getByRole("button", { name: "Locate root cause" }).click();
  await page.getByRole("button", { name: "Inspect safe checkpoint" }).click();
  await page.getByRole("button", { name: "Fork from this step" }).click();
  await expect(page.getByText("Ready to create a child run")).toBeVisible();
  await page.getByRole("button", { name: "Create child run" }).click();

  await expect(
    page.getByRole("heading", {
      name: "The child removed the failure without mutating its parent",
    }),
  ).toBeVisible({ timeout: 45_000 });
  await expect(page).toHaveURL(/\/runs\/codefix_/);
  await page.reload();
  await expect(
    page.getByRole("heading", {
      name: "The child removed the failure without mutating its parent",
    }),
  ).toBeVisible({ timeout: 20_000 });
  await expect(page.getByText("Parent vs child facts")).toBeVisible();
});
