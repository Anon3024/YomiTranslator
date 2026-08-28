#!/usr/bin/env node
/**
 * Standalone build for pkg packaging.
 *
 * `vite build` with `NITRO_PRESET=node-server` emits a runnable Nitro server
 * at `.output/server/index.mjs` plus the client assets under
 * `.output/public/` — the shape `@yao-pkg/pkg` snapshots into a single binary.
 *
 * The default `npm run build` keeps `preset: "vercel"` for deploys; this script
 * only overrides the preset for the packaging build and skips `db:migrate`
 * (there is no `DATABASE_URL` and no DB to migrate locally).
 */
import { spawn } from "node:child_process";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";

process.env.NITRO_PRESET = "node-server";

const root = dirname(dirname(fileURLToPath(import.meta.url)));
const wrapper = join(root, "scripts", "with-app-env.mjs");

const child = spawn(process.execPath, [wrapper, "vite", "build"], {
  stdio: "inherit",
});

child.on("error", (err) => {
  console.error(`[build-standalone] failed to run vite build: ${err?.message || err}`);
  process.exit(127);
});

child.on("exit", (code, signal) => {
  process.exit(signal ? 1 : code ?? 1);
});
