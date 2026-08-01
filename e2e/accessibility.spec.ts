import AxeBuilder from "@axe-core/playwright";
import { expect, test, type Page } from "@playwright/test";

async function expectNoSeriousViolations(page: Page, label: string) {
  const results = await new AxeBuilder({ page }).analyze();
  const blocking = results.violations.filter(
    (violation) => violation.impact === "serious" || violation.impact === "critical",
  );
  expect(blocking, `${label}: ${JSON.stringify(blocking, null, 2)}`).toEqual([]);
}

test("homepage and Case Study have no serious accessibility violations", async ({ page }) => {
  await page.goto("/");
  await expect(page.locator("main[data-hydrated='true']")).toBeVisible();
  await expectNoSeriousViolations(page, "homepage");

  await page.goto("/case-study");
  await expect(page.getByRole("heading", { name: /final answer cannot explain/ })).toBeVisible();
  await expectNoSeriousViolations(page, "case-study");
});

test("Demo, Compare and Eval views have no serious accessibility violations", async ({ page }) => {
  await page.goto("/demos/code-fix-loop");
  await expect(page.getByRole("heading", { name: /Failure: the parent ends/ })).toBeVisible();
  await expectNoSeriousViolations(page, "demo-parent");

  await page.getByRole("button", { name: "Locate root cause" }).click();
  await page.getByRole("button", { name: "Inspect safe checkpoint" }).click();
  await page.getByRole("button", { name: "Fork from this step" }).click();
  await page.getByRole("button", { name: "Replay fixed fixture" }).click();

  await expect(page.getByRole("heading", { name: /child removed the failure/ })).toBeVisible();
  await expect(page.getByText("Parent vs child facts")).toBeVisible();
  await expectNoSeriousViolations(page, "compare");

  await page.getByRole("button", { name: "Eval Report" }).click();
  await expect(page.getByText("Deterministic rule scores")).toBeVisible();
  await expectNoSeriousViolations(page, "eval");
});
