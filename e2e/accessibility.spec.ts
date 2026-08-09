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
  await expect(page.getByRole("heading", { name: /Understand why an agent failed/ })).toBeVisible();
  await expectNoSeriousViolations(page, "homepage");

  await page.goto("/case-study");
  await expect(page.getByRole("heading", { name: /clearer way to debug agent failures/ })).toBeVisible();
  await expectNoSeriousViolations(page, "case-study");

  await page.goto("/zh");
  await expect(page.locator("html")).toHaveAttribute("lang", "zh-CN");
  await expectNoSeriousViolations(page, "homepage-zh");

  await page.goto("/zh/case-study");
  await expect(page.getByRole("heading", { name: /更清晰的产品路径/ })).toBeVisible();
  await expectNoSeriousViolations(page, "case-study-zh");
});

test("Demo, Compare and Eval views have no serious accessibility violations", async ({ page }) => {
  await page.goto("/demos/code-fix-loop");
  await expect(page.getByRole("heading", { name: /Follow one failed agent/ })).toBeVisible();
  await expectNoSeriousViolations(page, "demo-intro");

  await page.goto("/demos/code-fix-loop?step=verified&details=trace");
  await expect(page.getByRole("heading", { name: /fixed the failure without adding a regression/ })).toBeVisible();
  await expect(page.getByText("Parent vs child facts")).toBeVisible();
  await expectNoSeriousViolations(page, "compare");

  await page.getByRole("button", { name: "Eval Report" }).click();
  await expect(page.getByText("Deterministic rule scores")).toBeVisible();
  await expectNoSeriousViolations(page, "eval");
});
