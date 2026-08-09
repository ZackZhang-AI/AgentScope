import { expect, test } from "@playwright/test";
import { readFile } from "node:fs/promises";

test.describe.configure({ mode: "serial" });

test("recorded story reveals one decision at a time and keeps technical evidence optional", async ({
  page,
}) => {
  await page.context().grantPermissions(["clipboard-read", "clipboard-write"]);
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

  await page.getByRole("button", { name: "Generate product brief" }).click();
  await expect(page).toHaveURL(/details=brief/);
  await expect(page.getByRole("heading", { name: "Agent product decision brief" })).toBeVisible();
  await expect(page.getByText("no_progress_loop", { exact: true })).toHaveCount(0);
  await expect(page.getByText(/Workspace Hash/i)).toHaveCount(0);
  await page.getByRole("button", { name: "Copy Markdown" }).click();
  await expect(page.getByRole("button", { name: "Markdown copied" })).toBeVisible();
  const copiedMarkdown = await page.evaluate(() => navigator.clipboard.readText());
  const downloadPromise = page.waitForEvent("download");
  await page.getByRole("button", { name: "Download .md" }).click();
  const download = await downloadPromise;
  expect(download.suggestedFilename()).toBe("agentscope-code-fix-brief-en.md");
  const downloadPath = await download.path();
  expect(downloadPath).toBeTruthy();
  const normalizeLineEndings = (content: string) => content.replace(/\r\n/g, "\n");
  expect(normalizeLineEndings(await readFile(downloadPath!, "utf8"))).toBe(
    normalizeLineEndings(copiedMarkdown),
  );

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

  await page.goto("/demos/code-fix-loop?step=verified&details=brief");
  await expect(page.getByRole("heading", { name: "Agent product decision brief" })).toBeVisible();
  const briefHasHorizontalOverflow = await page.evaluate(() => document.documentElement.scrollWidth > window.innerWidth);
  expect(briefHasHorizontalOverflow).toBe(false);
});

test("brief download remains available when Clipboard is unavailable", async ({ page }) => {
  await page.addInitScript(() => {
    Object.defineProperty(Navigator.prototype, "clipboard", {
      configurable: true,
      get: () => undefined,
    });
  });
  await page.goto("/demos/code-fix-loop?step=verified&details=brief");
  await page.getByRole("button", { name: "Copy Markdown" }).click();
  await expect(page.getByText("Copy is unavailable. You can still download the file.")).toBeVisible();
  const downloadPromise = page.waitForEvent("download");
  await page.getByRole("button", { name: "Download .md" }).click();
  expect((await downloadPromise).suggestedFilename()).toBe("agentscope-code-fix-brief-en.md");
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
  await page.getByRole("button", { name: "生成产品复盘摘要" }).click();
  await expect(page.getByRole("heading", { name: "Agent 产品复盘摘要" })).toBeVisible();
  await page.evaluate(() => { window.location.hash = "codefix_demo_child:tool:4"; });
  await page.getByRole("link", { name: "Switch to English" }).click();
  await expect(page).toHaveURL(/\/demos\/code-fix-loop\?step=verified&details=brief#codefix_demo_child:tool:4$/);
  await expect(page.getByRole("heading", { name: "Agent product decision brief" })).toBeVisible();

  await page.getByRole("button", { name: "View technical evidence" }).click();
  await page.getByRole("button", { name: "Eval Report" }).click();
  await expect(page.getByText("Deterministic rule scores")).toBeVisible();
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
