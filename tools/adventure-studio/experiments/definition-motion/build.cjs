"use strict";
const fs = require("node:fs"),
  path = require("node:path"),
  cp = require("node:child_process"),
  zlib = require("node:zlib");
function buildDefinition(root, out) {
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
  const code = fs.readFileSync(path.join(out, "runtime.js"));
  fs.writeFileSync(
    path.join(out, "budget.json"),
    JSON.stringify({
      javascriptBytes: code.length,
      gzipBytes: zlib.gzipSync(code).length,
    }),
  );
}
module.exports = { buildDefinition };
