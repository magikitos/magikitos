"use strict";
const path = require("node:path"),
  fs = require("node:fs"),
  cp = require("node:child_process");
function esbuild(root) {
  if (process.env.WORLD_ESBUILD) return process.env.WORLD_ESBUILD;
  const local = path.join(root, "node_modules/.bin/esbuild");
  if (fs.existsSync(local)) return local;
  const probe = cp.spawnSync("which", ["esbuild"], { encoding: "utf8" });
  if (probe.status === 0) return probe.stdout.trim();
  const cache = path.join(require("node:os").homedir(), ".npm/_npx");
  if (fs.existsSync(cache))
    for (const dir of fs.readdirSync(cache)) {
      const p = path.join(cache, dir, "node_modules/.bin/esbuild");
      if (fs.existsSync(p)) return p;
    }
  throw Error(
    "Falta esbuild local. Indica WORLD_ESBUILD=/ruta/a/esbuild. El studio no descarga dependencias.",
  );
}
function build(root, out) {
  fs.mkdirSync(out, { recursive: true });
  cp.execFileSync(
    esbuild(root),
    [
      path.join(__dirname, "app.js"),
      "--bundle",
      "--outfile=" + path.join(out, "studio.js"),
    ],
    { stdio: "inherit" },
  );
}
module.exports = { build, esbuild };
