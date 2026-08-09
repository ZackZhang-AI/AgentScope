import { mkdirSync } from "node:fs";
import path from "node:path";
import { chromium } from "@playwright/test";

const baseUrl = process.env.BASE_URL ?? "http://127.0.0.1:3000";
const pauseScale = Number(process.env.DEMO_PAUSE_SCALE ?? "1");
if (!Number.isFinite(pauseScale) || pauseScale < 0) {
  throw new Error("DEMO_PAUSE_SCALE must be a non-negative number.");
}
const outputDirectory = path.resolve("output", "videos");
mkdirSync(outputDirectory, { recursive: true });

const browser = await chromium.launch({ headless: true });
const stories = [
  {
    locale: "en",
    path: "/demos/code-fix-loop",
    failure: "See the failure",
    cause: "Why did it keep failing?",
    evidence: "View original evidence",
    fork: "Create a new attempt",
    confirm: "Confirm new attempt",
    verifiedHeading: /fixed the failure without adding a regression/,
    brief: "Generate product brief",
    briefHeading: "Agent product decision brief",
    copy: "Copy Markdown",
  },
  {
    locale: "zh",
    path: "/zh/demos/code-fix-loop",
    failure: "开始查看失败",
    cause: "为什么会一直失败？",
    evidence: "查看原始证据",
    fork: "从失败前创建新尝试",
    confirm: "确认并创建新尝试",
    verifiedHeading: /没有引入新的回归/,
    brief: "生成产品复盘摘要",
    briefHeading: "Agent 产品复盘摘要",
    copy: "复制 Markdown",
  },
];

for (const story of stories) {
  const context = await browser.newContext({
    viewport: { width: 1440, height: 900 },
    recordVideo: { dir: outputDirectory, size: { width: 1440, height: 900 } },
  });
  const page = await context.newPage();
  const video = page.video();
  const pause = (milliseconds) => page.waitForTimeout(milliseconds * pauseScale);

  await page.goto(`${baseUrl}${story.path}`, { waitUntil: "networkidle" });
  await pause(5_000);
  await page.getByRole("button", { name: story.failure }).click();
  await pause(8_000);
  await page.getByRole("button", { name: story.cause }).click();
  await pause(10_000);
  await page.getByText(story.evidence).click();
  await pause(4_000);
  await page.getByRole("button", { name: story.fork }).click();
  await pause(8_000);
  await page.getByRole("button", { name: story.confirm }).click();
  await page.getByRole("heading", { name: story.verifiedHeading }).waitFor();
  await pause(10_000);
  await page.getByRole("button", { name: story.brief }).click();
  const briefHeading = page.getByRole("heading", { name: story.briefHeading });
  await briefHeading.waitFor();
  await briefHeading.scrollIntoViewIfNeeded();
  await pause(15_000);
  await page.getByRole("button", { name: story.copy }).scrollIntoViewIfNeeded();
  await pause(5_000);

  await context.close();
  if (!video) throw new Error(`Playwright did not create the ${story.locale} video stream.`);
  const outputPath = path.join(outputDirectory, `agentscope-90-second-demo-${story.locale}.webm`);
  await video.saveAs(outputPath);
  console.log(`Demo video saved to ${outputPath}`);
}

await browser.close();
