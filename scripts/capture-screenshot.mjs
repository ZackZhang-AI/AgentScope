import { chromium } from "playwright";

const baseUrl = process.env.HARNESSLAB_URL || "http://127.0.0.1:3000";
const browser = await chromium.launch({ channel: "chrome" });

try {
  const page = await browser.newPage({
    viewport: { width: 1440, height: 1100 },
    deviceScaleFactor: 1,
  });
  await page.goto(baseUrl);
  await page.locator("main[data-hydrated='true']").waitFor();
  await page.getByRole("button", { name: "Start 90-second demo" }).click();
  await page
    .getByRole("heading", {
      name: "Root cause: repeated tests produced no workspace progress",
    })
    .waitFor();
  await page.screenshot({
    path: "public/harnesslab-desktop.png",
    fullPage: true,
  });
} finally {
  await browser.close();
}
