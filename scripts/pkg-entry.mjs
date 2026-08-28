#!/usr/bin/env node
/**
 * pkg entrypoint: start the built Nitro server and open the browser.
 *
 * Runs inside the `@yao-pkg/pkg` snapshot — `../.output/server/index.mjs` and
 * `../.output/public/**` are bundled as pkg assets, so no Node or npm is
 * required on the host machine.
 */
import { spawn } from "node:child_process";

const PORT = Number(process.env.PORT || process.env.NITRO_PORT || 8080);
const url = `http://localhost:${PORT}/`;
process.env.PORT = String(PORT);
process.env.NITRO_PORT = String(PORT);

function openBrowser(target) {
  const opts = { stdio: "ignore", detached: true };
  let child;
  if (process.platform === "win32") {
    // `start` is a cmd builtin; the empty title arg keeps a quoted URL intact.
    child = spawn("cmd", ["/c", "start", "", target], opts);
  } else if (process.platform === "darwin") {
    child = spawn("open", [target], opts);
  } else {
    child = spawn("xdg-open", [target], opts);
  }
  child.on("error", () => {});
  child.unref();
}

async function waitForServer(timeoutMs = 15000) {
  const deadline = Date.now() + timeoutMs;
  while (Date.now() < deadline) {
    try {
      const res = await fetch(url, { signal: AbortSignal.timeout(1000) });
      if (res.status < 500) return true;
    } catch {
      // Not listening yet.
    }
    await new Promise((resolve) => setTimeout(resolve, 250));
  }
  return false;
}

const server = import("../.output/server/index.mjs");
server.catch((err) => {
  console.error(`[yomi] failed to start server: ${err?.message || err}`);
  process.exit(1);
});

if (await waitForServer()) {
  if (process.env.YOMI_NO_BROWSER !== "1") openBrowser(url);
  console.log(`Yomi is running at ${url}`);
}

await server;
