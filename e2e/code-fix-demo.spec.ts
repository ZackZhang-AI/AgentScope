import { expect, test } from "@playwright/test";

test.describe.configure({ mode: "serial" });

test("recorded story reveals one decision at a time and keeps technical evidence optional", async ({
  page,
}) => {
  let sandboxExecutions = 0;
  page.on("request", (request) => {
    if (request.method() === "POST" && new URL(request.url()).pathname === "/api/v1/runs") {
      sandboxExecutions += 1;
    }
  });

  await page.goto("/");
  await expect(page.getByRole("heading", { name: /Understand why an agent failed/ })).toBeVisible();
  await page.getByRole("link", { name: "Start 90-second demo" }).first().click();

  await expect(page).toHaveURL(/\/demos\/code-fix-loop$/);
  await expect(page.locator("main[data-hydrated='true']")).toBeVisible();
  await expect(page.getByRole("heading", { name: /Follow one failed agent/ })).toBeVisible();
  await expect(page.getByRole("heading", { name: "Harness trace" })).toHaveCount(0);
  if ((page.viewportSize()?.width ?? 0) >= 768) {
    await expect(page.getByRole("button", { name: /New attempt:/ })).toBeDisabled();
  }

  await page.getByRole("button", { name: "See the failure" }).click();
  await expect(page).toHaveURL(/step=failure/);
  await expect(page.getByRole("heading", { name: /changed code, but the task still failed/ })).toBeVisible();
  await expect(page.getByText("run_tests", { exact: true })).toHaveCount(0);

  await page.getByRole("button", { name: "Why did it keep failing?" }).click();
  await expect(page).toHaveURL(/step=root-cause/);
  await expect(page.getByRole("heading", { name: /repeated work without making progress/ })).toBeVisible();
  await expect(page.getByText("no_progress_loop", { exact: true })).not.toBeVisible();
  await page.getByText("View original evidence").click();
  await expect(page.getByText("no_progress_loop", { exact: true })).toBeVisible();
  await expect(page.getByText("run_tests", { exact: true }).first()).toBeVisible();

  await page.getByRole("button", { name: "Create a new attempt" }).click();
  await expect(page).toHaveURL(/step=fork/);
  await expect(page.getByText("The original attempt and its evidence stay unchanged.")).toBeVisible();
  await page.getByRole("button", { name: "Confirm new attempt" }).click();

  await expect(page).toHaveURL(/step=verified/);
  await expect(page.getByRole("heading", { name: /fixed the failure without adding a regression/ })).toBeVisible();
  await expect(page.getByText("No new regression was detected")).toBeVisible();
  await expect(page.getByRole("heading", { name: "Harness trace" })).toHaveCount(0);

  await page.getByRole("button", { name: "View technical evidence" }).click();
  await expect(page).toHaveURL(/details=trace/);
  await expect(page.getByRole("heading", { name: "Complete technical evidence" })).toBeVisible();
  await expect(page.getByRole("heading", { name: "Harness trace" })).toBeVisible();
  await expect(page.getByText("Parent vs child facts")).toBeVisible();
  await expect(page.getByText("Resolved", { exact: true })).toBeVisible();

  await page.getByRole("treeitem").filter({ hasText: "apply_patch" }).click();
  await page.getByRole("tab", { name: "Artifacts" }).click();
  await expect(page.getByRole("button", { name: "diff" })).toBeVisible();
  await expect(page.getByText(/session\.role === "admin"/)).toBeVisible();
  expect(sandboxExecutions).toBe(0);
});

test("guided demo restores shareable states and stays within the mobile viewport", async ({ page }) => {
  await page.setViewportSize({ width: 390, height: 844 });
  await page.goto("/demos/code-fix-loop?step=root-cause");
  await expect(page.locator("main[data-hydrated='true']")).toBeVisible();
  await expect(page.getByRole("heading", { name: /repeated work without making progress/ })).toBeVisible();
  await expect(page.getByText("Cause", { exact: true }).first()).toBeVisible();

  const hasHorizontalOverflow = await page.evaluate(() => document.documentElement.scrollWidth > window.innerWidth);
  expect(hasHorizontalOverflow).toBe(false);

  await page.goto("/demos/code-fix-loop?view=verified");
  await expect(page.getByRole("heading", { name: /fixed the failure without adding a regression/ })).toBeVisible();
  await expect(page).toHaveURL(/view=verified/);
});

test("Chinese story uses plain language and preserves share state when switching language", async ({ page }) => {
  await page.goto("/zh/demos/code-fix-loop");
  await expect(page.locator("html")).toHaveAttribute("lang", "zh-CN");
  await expect(page.getByRole("heading", { name: /跟随一次失败的 Agent/ })).toBeVisible();
  await expect(page.getByText("no_progress_loop", { exact: true })).toHaveCount(0);

  await page.getByRole("button", { name: "开始查看失败" }).click();
  await page.getByRole("button", { name: "为什么会一直失败？" }).click();
  await page.getByText("查看原始证据").click();
  await expect(page.getByText("no_progress_loop", { exact: true })).toBeVisible();
  await expect(page.getByText("run_tests", { exact: true }).first()).toBeVisible();

  await page.getByRole("button", { name: "从失败前创建新尝试" }).click();
  await page.getByRole("button", { name: "确认并创建新尝试" }).click();
  await expect(page.getByRole("heading", { name: /没有引入新的回归/ })).toBeVisible();
  await page.getByRole("button", { name: "查看完整技术证据" }).click();
  await page.getByRole("button", { name: "Eval 报告v1" }).click();
  await expect(page.getByText("确定性规则评分")).toBeVisible();

  await page.evaluate(() => { window.location.hash = "span-tool-test-success"; });
  await page.getByRole("link", { name: "Switch to English" }).click();
  await expect(page).toHaveURL(/\/demos\/code-fix-loop\?step=verified&details=trace#span-tool-test-success$/);
});

test("local sandbox remains available in the advanced workbench", async ({ page }) => {
  test.skip(
    process.env.E2E_SANDBOX !== "1",
    "Set E2E_SANDBOX=1 with PostgreSQL and Docker to run the real sandbox flow.",
  );

  await page.goto("/workbench");
  await expect(page.locator("main[data-hydrated='true']")).toBeVisible();
  const runButton = page.getByRole("button", { name: "Run sandbox agent" });
  await expect(runButton).toBeEnabled({ timeout: 20_000 });
  await runButton.click();

  await expect(page.getByRole("heading", { name: "Harness trace" })).toBeVisible({ timeout: 45_000 });
  await page.getByRole("treeitem").filter({ hasText: "run_tests" }).first().click();
  await page.getByRole("tab", { name: "Replay" }).click();
  await page.getByRole("button", { name: "Fork from this step" }).click();
  await expect(page.getByText("Ready to create a child run")).toBeVisible();
  await page.getByRole("button", { name: "Create child run" }).click();

  await expect(page.getByRole("heading", { name: /child removed the failure/ })).toBeVisible({ timeout: 45_000 });
  await expect(page).toHaveURL(/\/runs\/codefix_/);
  await page.reload();
  await expect(page.getByText("Parent vs child facts")).toBeVisible({ timeout: 20_000 });
});
