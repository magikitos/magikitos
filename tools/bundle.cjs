"use strict";
/**
 * The game bundle, one recipe for the release build and for browser tests: the terrain worker
 * is bundled first and its source injected as `__TERRAIN_WORKER_SOURCE__`, so the page stays a
 * single inline engine and the worker starts from a Blob. A bundle made without this recipe has
 * no worker and paints the ground on the main thread, which is the supported fallback.
 */
const path = require("node:path"),
  cp = require("node:child_process");
const { esbuild } = require("./adventure-studio/build.cjs");
const ENTRY = "public/assets/js/aventura.js",
  WORKER = "public/assets/js/adventure/terrain-worker.js";

function workerSource(root, { minify = true } = {}) {
  return cp.execFileSync(esbuild(root), [WORKER, "--bundle", ...(minify ? ["--minify"] : []), "--format=iife"], {
    cwd: root,
    encoding: "utf8",
    maxBuffer: 16 * 1024 * 1024,
  });
}
/** Release bundle, written to `outfile`. */
function bundleGame(root, outfile) {
  cp.execFileSync(
    esbuild(root),
    [ENTRY, "--bundle", "--minify", "--outfile=" + outfile,
      "--define:__TERRAIN_WORKER_SOURCE__=" + JSON.stringify(workerSource(root))],
    { cwd: root, stdio: "inherit" },
  );
}
/** In-memory bundle for browser tests, with the same worker as a release. */
async function bundleForTest(root = path.resolve(__dirname, "..")) {
  const { build } = require("esbuild");
  return build({
    absWorkingDir: root,
    entryPoints: [ENTRY],
    bundle: true,
    write: false,
    define: { __TERRAIN_WORKER_SOURCE__: JSON.stringify(workerSource(root, { minify: false })) },
  });
}
module.exports = { bundleGame, bundleForTest };
