"use strict";
const fs = require("node:fs"),
  path = require("node:path"),
  cp = require("node:child_process"),
  crypto = require("node:crypto");
const { esbuild } = require("./adventure-studio/build.cjs");
const { compileWorld } = require("./world.cjs");
const { page, ROUTES } = require("./page.cjs");
const { composeLocales } = require("./locales.cjs");
const { verify } = require("./artifact.cjs");
const root = path.resolve(__dirname, ".."),
  out = path.join(root, ".local/build");
function build({ reuseArt = false } = {}) {
  const scratch = fs.mkdtempSync(
    path.join(require("node:os").tmpdir(), "magikitos-build-"),
  );
  const assets = path.join(scratch, "assets");
  const audio = JSON.parse(fs.readFileSync(path.join(root, "public/assets/audio/catalog.json")));
  fs.cpSync(path.join(root, "public/assets/audio"), path.join(assets, "audio"), { recursive: true });
  fs.mkdirSync(path.join(assets, "js"), { recursive: true });
  fs.mkdirSync(path.join(assets, "css"), { recursive: true });
  if (!reuseArt)
    // El retrato del elenco se DERIVA de las hojas ya registradas, así que se rehace justo antes
    // de hornear: nunca puede quedarse describiendo un duende que ya no se dibuja así.
    for (const script of [
      "scripts/prepare-cast-portraits.php",
      "scripts/bake-adventure-atlas.php",
    ])
      cp.execFileSync(process.env.STUDIO_PHP || "php", [script], {
        cwd: root,
        stdio: "inherit",
      });
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
  const world = compileWorld(root);
  // El motor va incrustado en la página; lo que dice cada pantalla viaja con la pantalla.
  // Ver tools/locales.cjs: componer aborta si una clave falta, se repite o ya no la dice nadie.
  const locales = composeLocales(world);
  for (const [scene, bundle] of Object.entries(locales.scenes))
    for (const [locale, strings] of Object.entries(bundle)) {
      const target = path.join(assets, "locales", locale, scene + ".json");
      fs.mkdirSync(path.dirname(target), { recursive: true });
      fs.writeFileSync(target, JSON.stringify(strings));
    }
  // La barca amarrada se pega a los tablones de su muelle. Va antes del contrato porque el mundo
  // que se serializa para el navegador es este mismo objeto.
  require("./moor-vessels.cjs").moorVessels(world);
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
  for (const [locale, strings] of Object.entries(locales.core)) {
    const config = {
      ...settings,
      locale,
      strings,
      // La pantalla de arranque viaja dentro de la página: quien llega nuevo no espera una
      // petición más para leer el primer cartel. Las demás se piden con sus sprites.
      sceneStrings: { [world.start]: locales.scenes[world.start][locale] },
      localeBase: prefix + "/assets/locales/" + locale + "/",
      world,
      baseUrl: ROUTES[locale],
      assetManifest: prefix + "/assets/aventura/manifest.json",
      audio,
      audioBase: prefix + "/assets/audio/",
      neighbors: [],
      cast: {},
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
