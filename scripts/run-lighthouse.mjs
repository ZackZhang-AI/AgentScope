import { mkdirSync } from "node:fs";
import { spawn } from "node:child_process";
import path from "node:path";

const environment = { ...process.env };
if (process.platform === "win32") {
  const drive = process.env.SystemDrive ?? "C:";
  const tempDirectory = path.join(`${drive}\\`, "Temp", "agentscope-lighthouse");
  mkdirSync(tempDirectory, { recursive: true });
  environment.TEMP = tempDirectory;
  environment.TMP = tempDirectory;
}

const cli = path.resolve("node_modules", "@lhci", "cli", "src", "cli.js");
const child = spawn(
  process.execPath,
  [cli, "autorun", "--config=lighthouserc.json"],
  { stdio: "inherit", env: environment },
);

child.on("error", (error) => {
  console.error(error);
  process.exitCode = 1;
});
child.on("exit", (code) => {
  process.exitCode = code ?? 1;
});
