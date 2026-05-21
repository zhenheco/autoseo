import { spawnSync } from "node:child_process";

const args = process.argv.slice(2).map((arg) => {
  const webPrefix = "packages/web/";
  return arg.startsWith(webPrefix) ? arg.slice(webPrefix.length) : arg;
});

const result = spawnSync("vitest", ["run", ...args], {
  stdio: "inherit",
  shell: process.platform === "win32",
});

process.exit(result.status ?? 1);
