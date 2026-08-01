import { spawn } from "node:child_process";
import { mkdirSync, readFileSync, rmSync, writeFileSync } from "node:fs";
import net from "node:net";
import path from "node:path";
import { chromium } from "playwright";

const waitForFreePort = () =>
  new Promise((resolve, reject) => {
    const server = net.createServer();
    server.once("error", reject);
    server.listen(0, "127.0.0.1", () => {
      const address = server.address();
      if (!address || typeof address === "string") {
        server.close();
        reject(new Error("Unable to allocate a Chrome debugging port."));
        return;
      }
      server.close(() => resolve(address.port));
    });
  });

const waitForChrome = async (port) => {
  const endpoint = `http://127.0.0.1:${port}/json/version`;
  for (let attempt = 0; attempt < 50; attempt += 1) {
    try {
      const response = await fetch(endpoint);
      if (response.ok) return;
    } catch {
      // Chrome may need a moment to expose its debugging endpoint.
    }
    await new Promise((resolve) => setTimeout(resolve, 100));
  }
  throw new Error("Chrome debugging endpoint did not become ready.");
};

const outputDirectory = path.resolve("output", "lighthouse");
const profileDirectory = path.join(outputDirectory, "chrome-profile");
mkdirSync(outputDirectory, { recursive: true });
rmSync(profileDirectory, { recursive: true, force: true });

const port = await waitForFreePort();
const chrome = await chromium.launchPersistentContext(profileDirectory, {
  channel: "chrome",
  headless: true,
  args: [
    "--headless=new",
    "--disable-gpu",
    "--no-first-run",
    `--remote-debugging-port=${port}`,
  ],
});

try {
  await waitForChrome(port);
  const config = JSON.parse(readFileSync("lighthouserc.json", "utf8"));
  config.ci.collect.settings = {
    ...config.ci.collect.settings,
    port,
  };
  const runtimeConfig = path.join(outputDirectory, "runtime-config.json");
  writeFileSync(runtimeConfig, `${JSON.stringify(config, null, 2)}\n`);

  const cli = path.resolve("node_modules", "@lhci", "cli", "src", "cli.js");
  const child = spawn(
    process.execPath,
    [cli, "autorun", `--config=${runtimeConfig}`],
    { stdio: "inherit", env: process.env },
  );
  const exitCode = await new Promise((resolve, reject) => {
    child.once("error", reject);
    child.once("exit", (code) => resolve(code ?? 1));
  });
  process.exitCode = exitCode;
} finally {
  await chrome.close();
}
