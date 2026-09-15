"use strict";
const fs = require("node:fs"),
  path = require("node:path"),
  cp = require("node:child_process"),
  crypto = require("node:crypto");
const { esbuild } = require("./adventure-studio/build.cjs");
const { page, ROUTES } = require("./page.cjs");
const { verify } = require("./artifact.cjs");
const root = path.resolve(__dirname, ".."),
  out = path.join(root, ".local/build");
function build({ reuseArt = false } = {}) {
  const scratch = fs.mkdtempSync(
    path.join(require("node:os").tmpdir(), "magikitos-build-"),
  );
  const assets = path.join(scratch, "assets");
  fs.mkdirSync(path.join(assets, "js"), { recursive: true });
  fs.mkdirSync(path.join(assets, "css"), { recursive: true });
  if (!reuseArt)
    cp.execFileSync(
      process.env.STUDIO_PHP || "php",
      ["scripts/bake-adventure-atlas.php"],
      { cwd: root, stdio: "inherit" },
    );
  cp.execFileSync(
    esbuild(root),
    [
      "public/assets/js/aventura.js",
      "--bundle",
      "--minify",
      "--outfile=" + path.join(assets, "js/aventura.min.js"),
    ],
    { cwd: root, stdio: "inherit" },
  );
  cp.execFileSync(
    esbuild(root),
    [
      "public/assets/css/aventura.css",
      "--bundle",
      "--minify",
      "--external:../fonts/*",
      "--outfile=" + path.join(assets, "css/aventura.min.css"),
    ],
    { cwd: root, stdio: "inherit" },
  );
  fs.mkdirSync(path.join(assets, "aventura/packs"), { recursive: true });
  const artRoot = path.join(root, "public/assets/aventura");
  const manifest = JSON.parse(
    fs.readFileSync(path.join(artRoot, "manifest.json")),
  );
  fs.copyFileSync(
    path.join(artRoot, "manifest.json"),
    path.join(assets, "aventura/manifest.json"),
  );
  for (const pack of Object.values(manifest.packs))
    for (const rel of [pack.image, pack.metadata])
      fs.copyFileSync(
        path.join(artRoot, rel),
        path.join(assets, "aventura", rel),
      );
  fs.cpSync(
    path.join(root, "public/assets/fonts"),
    path.join(assets, "fonts"),
    { recursive: true },
  );
  const world = JSON.parse(
    cp.execFileSync(
      process.env.STUDIO_PHP || "php",
      [
        "-r",
        "echo json_encode(require $argv[1], JSON_THROW_ON_ERROR);",
        path.join(root, "data/aventura/world.php"),
      ],
      { encoding: "utf8", maxBuffer: 8 * 1024 * 1024 },
    ),
  );
  const locales = Object.fromEntries(
    Object.keys(ROUTES).map((locale) => [
      locale,
      JSON.parse(
        fs.readFileSync(
          path.join(root, "data/aventura/locales", locale + ".json"),
        ),
      ),
    ]),
  );
  const contract = require("./game-contract.cjs").gameContract(world);
  fs.writeFileSync(
    path.join(scratch, "game-contract.json"),
    JSON.stringify(contract) + "\n",
  );
  const settings = {
    apiBase: process.env.GAME_API_BASE || "/api/world/",
    websiteBase: process.env.GAME_WEBSITE_BASE || "/",
  };
  const hash = crypto.createHash("sha256");
  hash.update(
    JSON.stringify({ world, locales, contract, settings, routes: ROUTES }),
  );
  hash.update(fs.readFileSync(path.join(root, "public/game.html")));
  hash.update(fs.readFileSync(path.join(root, "tools/page.cjs")));
  function inventory(base, dir = "") {
    return fs
      .readdirSync(path.join(base, dir))
      .sort()
      .flatMap((name) => {
        const rel = path.join(dir, name);
        return fs.statSync(path.join(base, rel)).isDirectory()
          ? inventory(base, rel)
          : [rel];
      });
  }
  for (const rel of inventory(assets)) {
    hash.update(rel);
    hash.update(fs.readFileSync(path.join(assets, rel)));
  }
  const id = hash.digest("hex").slice(0, 20),
    prefix = "/game/releases/" + id;
  const release = path.join(out, "releases", id);
  fs.mkdirSync(path.join(scratch, "pages"), { recursive: true });
  for (const [locale, strings] of Object.entries(locales)) {
    const config = {
      ...settings,
      locale,
      strings,
      world,
      baseUrl: ROUTES[locale],
      assetManifest: prefix + "/assets/aventura/manifest.json",
      neighbors: [],
      cast: {},
      products: [],
      destinations: {},
      capabilities: {},
    };
    fs.writeFileSync(
      path.join(scratch, "pages", locale + ".html"),
      page(config, prefix),
    );
  }
  const files = Object.fromEntries(
    inventory(scratch).map((rel) => [
      rel,
      crypto
        .createHash("sha256")
        .update(fs.readFileSync(path.join(scratch, rel)))
        .digest("hex"),
    ]),
  );
  fs.writeFileSync(
    path.join(scratch, "release.json"),
    JSON.stringify({ id, routes: ROUTES, files }, null, 2) + "\n",
  );
  fs.mkdirSync(path.dirname(release), { recursive: true });
  if (!fs.existsSync(release))
    fs.cpSync(scratch, release, {
      recursive: true,
      errorOnExist: true,
      force: false,
    });
  verify(release, id);
  fs.writeFileSync(path.join(out, "world.json"), JSON.stringify(world));
  const pointer = path.join(out, "current.json"),
    temp = pointer + ".tmp";
  fs.writeFileSync(
    temp,
    JSON.stringify({ id, routes: ROUTES }, null, 2) + "\n",
  );
  fs.renameSync(temp, pointer);
  // Only the exact generated scratch directory is removed; user workspace/history is never touched.
  fs.rmSync(scratch, { recursive: true });
  console.log("Static game artifact: " + release);
  return release;
}
// Local JS/CSS iteration can reuse the already-baked, checksum-verified art. Normal builds always bake.
if (require.main === module)
  build({ reuseArt: process.argv.includes("--reuse-art") });
module.exports = { build, root, out };
