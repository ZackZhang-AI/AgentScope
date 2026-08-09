import { mkdirSync } from "node:fs";
import path from "node:path";
import { chromium } from "@playwright/test";

const baseUrl = process.env.BASE_URL ?? "http://127.0.0.1:3000";
const pauseScale = Number(process.env.DEMO_PAUSE_SCALE ?? "1");
if (!Number.isFinite(pauseScale) || pauseScale < 0) {
  throw new Error("DEMO_PAUSE_SCALE must be a non-negative number.");
}
const outputDirectory = path.resolve("output", "videos");
const outputPath = path.join(outputDirectory, "agentscope-90-second-demo.webm");
mkdirSync(outputDirectory, { recursive: true });

const browser = await chromium.launch({ headless: true });
const context = await browser.newContext({
  viewport: { width: 1440, height: 900 },
  recordVideo: { dir: outputDirectory, size: { width: 1440, height: 900 } },
});
const page = await context.newPage();
const video = page.video();

async function pause(milliseconds) {
  await page.waitForTimeout(milliseconds * pauseScale);
}

await page.goto(`${baseUrl}/demos/code-fix-loop`, { waitUntil: "networkidle" });
await pause(4_000);
await page.getByRole("button", { name: "See the failure" }).click();
await page.getByRole("heading", { name: /changed code, but the task still failed/ }).waitFor();
await pause(7_000);

await page.getByRole("button", { name: "Why did it keep failing?" }).click();
await pause(8_000);
await page.getByText("View original evidence").click();
await pause(5_000);
await page.getByRole("button", { name: "Create a new attempt" }).click();
await pause(7_000);
await page.getByRole("button", { name: "Confirm new attempt" }).click();

await page.getByRole("heading", { name: /fixed the failure without adding a regression/ }).waitFor();
await pause(9_000);
await page.getByRole("button", { name: "View technical evidence" }).click();
await page.getByRole("heading", { name: "Complete technical evidence" }).waitFor();
await pause(8_000);
await page.getByRole("link", { name: "Read product case" }).click();
await page.getByRole("heading", { name: /clearer way to debug agent failures/ }).waitFor();
await pause(7_000);

await context.close();
if (!video) throw new Error("Playwright did not create a video stream.");
await video.saveAs(outputPath);
await browser.close();
console.log(`Demo video saved to ${outputPath}`);
