"use strict";
/**
 * The forest-life delivery (`data/aventura/art/forest-life/catalog.json`) as sprite packages.
 *
 * The designer's sheets are already registered at the house density (2 texture pixels per world
 * unit), cell by cell: sitting and fishing poses share a foot anchor across frames, and a growth
 * stage shares its box and anchor with its mature bed. So each frame is copied as it is — a
 * `registration` of exactly 0.5 over its prepared cell — and never fitted, recentred or scaled
 * again, which would make the animation jump. `bake-adventure-atlas.php` then packs and indexes
 * them like every other package.
 *
 * One package per sheet: a scene loads the seated sheet of the faces it shows, not all eighteen.
 * The four mature beds leave `garden` for `garden-crops`, so a bed and its stages are one image.
 */
const fs = require("node:fs");
const path = require("node:path");

const root = path.join(__dirname, "..");
const art = "data/aventura/art/forest-life";
const catalog = JSON.parse(fs.readFileSync(path.join(root, art, "catalog.json")));
if (catalog.pixelRatio !== 2 || catalog.rectUnits !== "texture-pixels")
  throw Error("forest-life catalog must be registered at 2 texture pixels per unit");

/** The package each sheet becomes. Characters follow the `actor-<id>-<action>` convention. */
function packFor(sheet) {
  const person = /^person-(\d+)-(sit|fish)$/.exec(sheet);
  if (person) return `actor-${person[1]}-${person[2]}`;
  return { "garden-growth": "garden-crops", emotes: "emotes", "fish-splash": "fish-splash",
    "forest-diary": "forest-diary", "forest-diary-panel": "forest-diary-panel" }[sheet];
}

const packs = new Map();
for (const [name, frame] of Object.entries(catalog.frames)) {
  const sheet = catalog.sheets[frame.sheet];
  const pack = packFor(frame.sheet);
  if (!sheet || !pack) throw Error("Unknown forest-life sheet: " + frame.sheet);
  const [x, y, w, h] = frame.rect;
  const [sw, sh] = frame.size;
  if (w !== sw * 2 || h !== sh * 2) throw Error(`${name}: rect is not twice its logical size`);
  const definition = {
    source: sheet.image,
    rect: frame.rect,
    size: frame.size,
    anchor: frame.anchor,
    preserveCanvas: true,
    registration: { scale: 0.5, offset: [0, 0] },
  };
  // The panel is interface art with a soft edge; everything in the world keeps binary alpha.
  if (pack === "forest-diary-panel") definition.continuousAlpha = true;
  if (!packs.has(pack)) packs.set(pack, {});
  packs.get(pack)[name] = definition;
}

const out = path.join(root, "data/aventura/assets");
for (const [pack, frames] of packs)
  fs.writeFileSync(path.join(out, pack + ".json"), JSON.stringify({ frames }, null, 2) + "\n");

// The mature beds now live with their stages: `garden` must not register them a second time.
const gardenFile = path.join(out, "garden.json"),
  garden = JSON.parse(fs.readFileSync(gardenFile));
const moved = Object.keys(garden.frames).filter((name) => packs.get("garden-crops")[name]);
for (const name of moved) delete garden.frames[name];
if (moved.length) fs.writeFileSync(gardenFile, JSON.stringify(garden, null, 4) + "\n");

// Where the drawn rod ends, relative to the feet: the line to the float leaves from there.
const lifeFile = path.join(root, "data/aventura/life.json"),
  life = JSON.parse(fs.readFileSync(lifeFile)),
  rodTips = {};
for (const [name, frame] of Object.entries(catalog.frames))
  if (frame.rodTip)
    rodTips[name] = [+(frame.rodTip[0] - frame.anchor[0]).toFixed(2), +(frame.rodTip[1] - frame.anchor[1]).toFixed(2)];
life.rodTips = rodTips;
fs.writeFileSync(lifeFile, JSON.stringify(life, null, 2) + "\n");

console.log(`${Object.keys(catalog.frames).length} forest-life frames in ${packs.size} packages` +
  (moved.length ? `; ${moved.length} mature beds moved from garden` : ""));
