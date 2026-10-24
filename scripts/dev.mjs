// Run Vite and the local read-only Epi API with one command.
// Keep forwarding CLI arguments so Playwright's "--port" override still works.
import { spawn } from "node:child_process";
import { fileURLToPath } from "node:url";
import { join } from "node:path";

const root = fileURLToPath(new URL("../", import.meta.url));
const children = [];
let stopping = false;
function stop(code = 0) {
  if (stopping) return;
  stopping = true;
  process.exitCode = code;
  for (const child of children) if (!child.killed) child.kill();
}
const launch = (name, entry, args = []) => {
  const child = spawn(process.execPath, [join(root, entry), ...args], {
    cwd: root,
    stdio: "inherit",
    env: process.env,
  });
  children.push(child);
  child.on("error", (err) => {
    console.error(name + " could not start:", err.message);
    stop(1);
  });
  child.on("exit", (code) => {
    if (!stopping) {
      console.error(name + " stopped.");
      stop(code ?? 1);
    }
  });
};
process.on("SIGINT", () => stop(130));
process.on("SIGTERM", () => stop(143));
launch("Epi API", "scripts/epi-dev.mjs");
launch("Vite", "node_modules/vite/bin/vite.js", [
  "--host",
  "0.0.0.0",
  ...process.argv.slice(2),
]);
