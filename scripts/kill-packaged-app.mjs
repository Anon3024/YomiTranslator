#!/usr/bin/env node
/**
 * Kill a running packaged binary before `pkg` rebuilds it.
 *
 * On Windows a running `app-builder-workspace-win.exe` holds an exclusive lock
 * on the file, so `pkg` cannot overwrite it (EBUSY). POSIX lets a running
 * executable be overwritten, but we stop it there too so the port it holds is
 * free for the freshly built binary.
 */
import { spawnSync } from "node:child_process";

const WIN_IMAGE = "app-builder-workspace-win.exe";

if (process.platform === "win32") {
  // /F force-kills; exit 128 ("not found") is fine — nothing to kill.
  spawnSync("taskkill", ["/F", "/IM", WIN_IMAGE], { stdio: "ignore" });
} else {
  spawnSync("pkill", ["-f", "app-builder-workspace"], { stdio: "ignore" });
}
