"use strict";
const fs = require("node:fs"),
  path = require("node:path"),
  cp = require("node:child_process"),
  zlib = require("node:zlib");
const { PROPS } = require("./config");
function buildCamera(root, out) {
  fs.mkdirSync(path.join(out, "art"), { recursive: true });
  cp.execFileSync(
    path.join(root, "node_modules/.bin/esbuild"),
    [
      path.join(__dirname, "entry.js"),
      "--bundle",
      "--minify",
      "--legal-comments=linked",
      "--outfile=" + path.join(out, "runtime.js"),
      "--metafile=" + path.join(out, "bundle.json"),
    ],
    { stdio: "inherit" },
  );
  fs.copyFileSync(
    path.join(root, "node_modules/three/LICENSE"),
    path.join(out, "THREE-LICENSE.txt"),
  );
  const source = path.join(root, "public/assets/aventura");
  const full = JSON.parse(
    fs.readFileSync(path.join(source, "manifest.json"), "utf8"),
  );
  const wanted = new Set([
    ...PROPS.map((p) => p.sprite),
    "person-0-down",
    "person-2-down",
  ]);
  const manifest = { packs: {} };
  for (const [id, pack] of Object.entries(full.packs)) {
    if (!pack.sprites.some((s) => wanted.has(s))) continue;
    const image = path.basename(pack.image),
      metadata = path.basename(pack.metadata);
    fs.copyFileSync(
      path.join(source, pack.image),
      path.join(out, "art", image),
    );
    fs.copyFileSync(
      path.join(source, pack.metadata),
      path.join(out, "art", metadata),
    );
    manifest.packs[id] = {
      ...pack,
      image,
      metadata,
      bytes: fs.statSync(path.join(source, pack.image)).size,
    };
  }
  fs.writeFileSync(
    path.join(out, "art/manifest.json"),
    JSON.stringify(manifest),
  );
  const code = fs.readFileSync(path.join(out, "runtime.js"));
  const report = {
    javascriptBytes: code.length,
    javascriptGzipBytes: zlib.gzipSync(code).length,
    imageBytes: Object.values(manifest.packs).reduce((n, p) => n + p.bytes, 0),
    three: JSON.parse(
      fs.readFileSync(
        path.join(root, "node_modules/three/package.json"),
        "utf8",
      ),
    ).version,
  };
  fs.writeFileSync(path.join(out, "budget.json"), JSON.stringify(report));
  console.log("Camera experiment:", JSON.stringify(report));
}
module.exports = { buildCamera };
