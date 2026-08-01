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

await page.goto(baseUrl, { waitUntil: "networkidle" });
await pause(5_000);
await page.getByRole("button", { name: "Start 90-second demo" }).click();
await page.getByRole("heading", { name: /Failure: the parent ends/ }).waitFor();
await pause(7_000);

await page.getByRole("button", { name: "Locate root cause" }).click();
await pause(8_000);
await page.getByRole("button", { name: "Inspect safe checkpoint" }).click();
await pause(8_000);
await page.getByRole("button", { name: "Fork from this step" }).click();
await pause(6_000);
await page.getByRole("button", { name: "Replay fixed fixture" }).click();

await page.getByRole("heading", { name: /child removed the failure/ }).waitFor();
await pause(9_000);
await page.getByRole("button", { name: "Eval Report" }).click();
await pause(8_000);
await page.getByRole("link", { name: "View Case Study" }).click();
await page.getByRole("heading", { name: /final answer cannot explain/ }).waitFor();
await pause(8_000);

await context.close();
if (!video) throw new Error("Playwright did not create a video stream.");
await video.saveAs(outputPath);
await browser.close();
console.log(`Demo video saved to ${outputPath}`);
