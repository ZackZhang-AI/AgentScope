import { expect, test } from "@playwright/test";

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
      name: "Root cause: repeated tests produced no workspace progress",
    }),
  ).toBeVisible();
  await expect(
    page.getByRole("button", { name: /No-progress tool loop/ }),
  ).toBeVisible();

  await page.getByRole("button", { name: /No-progress tool loop/ }).click();
  await page.getByRole("tab", { name: "Replay" }).click();
  await page.getByRole("button", { name: "Fork from this step" }).click();
  await expect(
    page.getByText("Ready for deterministic Fixture Replay"),
  ).toBeVisible();
  await page.getByRole("button", { name: "Replay fixed fixture" }).click();

  await expect(
    page.getByRole("heading", {
      name: "Verified fix: the child test passed",
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
      name: "Root cause: repeated tests produced no workspace progress",
    }),
  ).toBeVisible();
  await expect(page.getByText("Failure", { exact: true })).toBeVisible();
  await expect(page.getByText("Root cause", { exact: true })).toBeVisible();
  await expect(page.getByRole("tab", { name: "Artifacts" })).toBeVisible();
});
