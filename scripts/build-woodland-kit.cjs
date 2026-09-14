"use strict";
/** Build authored asset metadata/families from one art manifest. Never calls an image service. */
const fs = require("node:fs"),
  path = require("node:path");
const root = path.resolve(__dirname, ".."),
  dir = path.join(root, "data/aventura"),
  kit = JSON.parse(
    fs.readFileSync(path.join(dir, "art/woodland-kit/prompts.json")),
  );
const blueprint = JSON.parse(
  fs.readFileSync(path.join(dir, "element-families.json")),
).families;
const packs = {},
  families = {},
  owners = new Set(),
  write = (file, value) => {
    const text = JSON.stringify(value, null, 2) + "\n";
    if (!fs.existsSync(file) || fs.readFileSync(file, "utf8") !== text)
      fs.writeFileSync(file, text);
  };
const label = (id) =>
  ({ otono: "Otoño", castana: "Castaña", raices: "Raíces" })[id] ||
  id[0].toUpperCase() + id.slice(1).replaceAll("-", " ");
for (const a of kit.assets) {
  const source = "data/aventura/art/woodland-kit/cutouts/" + a.id + ".png";
  if (!fs.existsSync(path.join(root, source)))
    throw Error("Missing reviewed cutout: " + a.id);
  const frame = {
    source,
    grid: [1, 1],
    cell: [0, 0],
    size: a.size,
    fit: true,
    anchor: a.anchor,
    ...(a.flip ? { flip: true } : {}),
    ...(a.crop ? { crop: a.crop } : {}),
  };
  const frames = (packs["woodland-" + a.family] ||= { frames: {} }).frames;
  for (const sprite of [a.sprite, ...(a.aliases || [])]) {
    if (owners.has(sprite)) throw Error("Duplicate asset: " + sprite);
    owners.add(sprite);
    frames[sprite] = frame;
  }
  const b = blueprint[a.family];
  if (!b) throw Error("Missing family blueprint " + a.family);
  const f = (families[a.family] ||= {
    ...b,
    aliases: [],
    defaults: {},
    variants: [],
  });
  const variant = {
    id: a.variant,
    label: a.label || label(a.variant),
    sprite: a.sprite,
  };
  if (f.variants.some((v) => v.id === variant.id))
    throw Error("Duplicate family variant " + a.family + "/" + variant.id);
  f.variants.push(variant);
  for (const alias of [a.sprite, ...(a.aliases || [])]) {
    f.aliases.push(alias);
    f.defaults[alias] = a.variant;
  }
}
for (const [id, f] of Object.entries(blueprint))
  if (!families[id])
    families[id] = {
      ...f,
      aliases: f.aliases || f.variants.map((v) => v.sprite),
      defaults:
        f.defaults ||
        Object.fromEntries(f.variants.map((v) => [v.sprite, v.id])),
    };
// Remove only frame definitions superseded by this collection. Original artwork is retained.
const retired = [];
for (const name of fs
  .readdirSync(path.join(dir, "assets"))
  .filter((n) => n.endsWith(".json") && !n.startsWith("woodland-"))) {
  const file = path.join(dir, "assets", name),
    pack = JSON.parse(fs.readFileSync(file));
  if (!pack.frames) continue;
  const before = Object.keys(pack.frames).length;
  for (const sprite of owners) delete pack.frames[sprite];
  if (Object.keys(pack.frames).length === before) continue;
  if (Object.keys(pack.frames).length) write(file, pack);
  else {
    fs.unlinkSync(file);
    retired.push(name);
  }
}
for (const [id, p] of Object.entries(packs))
  write(path.join(dir, "assets", id + ".json"), p);
for (const f of Object.values(families)) {
  delete f.fixedVariants;
  if (!f.variants?.length) throw Error("Empty family " + f.label);
}
write(path.join(dir, "elements.json"), { families });
console.log(
  kit.assets.length +
    " artworks; " +
    Object.keys(packs).length +
    " family packs; " +
    owners.size +
    " sprite names. Retired definitions (original masters kept): " +
    retired.join(", "),
);
