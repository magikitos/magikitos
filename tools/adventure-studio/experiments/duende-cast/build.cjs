"use strict";
const fs = require("node:fs"),
  path = require("node:path"),
  cp = require("node:child_process");
function buildDuendes(root, out) {
  fs.mkdirSync(out, { recursive: true });
  cp.execFileSync(
    process.env.STUDIO_PHP || "php",
    [path.join(__dirname, "bake.php"), path.join(out, "art")],
    { stdio: "inherit" },
  );
  cp.execFileSync(
    path.join(root, "node_modules/.bin/esbuild"),
    [
      path.join(__dirname, "entry.js"),
      "--bundle",
      "--minify",
      "--outfile=" + path.join(out, "runtime.js"),
    ],
    { stdio: "inherit" },
  );
}
module.exports = { buildDuendes };
