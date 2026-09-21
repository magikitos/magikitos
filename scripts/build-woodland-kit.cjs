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
/**
 * Lo que este generador ya escribió antes. De aquí sale el CUERPO de cada variante, que es el
 * único dato de `elements.json` que no viene del manifiesto de arte: lo dibuja el dueño en el
 * Studio y lo aplica el agente, y volver a hornear el arte no puede borrárselo.
 */
const physics = fs.existsSync(path.join(dir, "elements.json"))
  ? JSON.parse(fs.readFileSync(path.join(dir, "elements.json"))).families
  : {};
const doorways = JSON.parse(
  fs.readFileSync(path.join(dir, "art/doorways/catalog.json")),
).assets;
const editions = new Map(doorways.map((a) => [a.asset, a.cutout]));
if (editions.size !== doorways.length) throw Error("Duplicate doorway edition");
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
  const source =
    a.source ||
    editions.get(a.id) ||
    "data/aventura/art/woodland-kit/cutouts/" + a.id + ".png";
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
  const frames = (packs["woodland-" + (a.pack || a.family)] ||= { frames: {} }).frames;
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
  /**
   * ⛔ EL CUERPO Y LA ENTRADA DE UNA VARIANTE SOBREVIVEN A ESTE GENERADOR (21-sep-2026, repaso).
   * Esto rehace 39 de las 77 familias desde el manifiesto de arte —entre ellas las CINCO de
   * casitas, que son justo para las que se hizo el editor de entradas— y solo escribía id,
   * rótulo y sprite. Aplicar una propuesta del Studio y volver a correr `art:catalog` la borraba
   * sin decir nada, y el Studio la volvía a proponer para siempre. El arte lo manda el
   * manifiesto; la física, no: la física es del elemento y se conserva.
   */
  const kept = (physics[a.family]?.variants || []).find((v) => v.id === a.variant);
  const variant = {
    id: a.variant,
    label: a.label || label(a.variant),
    sprite: a.sprite,
    ...(kept?.solids ? { solids: kept.solids } : {}),
    ...(kept?.entrance ? { entrance: kept.entrance } : {}),
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
// One authored cast catalog; prompts and source details never enter the runtime.
const profiles = JSON.parse(
  fs.readFileSync(path.join(dir, "art/residents/catalog.json")),
).profiles.map(({ id, key, family, gender, label, playableOnly }) => ({
  id,
  key,
  family,
  gender,
  ...(playableOnly ? { playableOnly: true } : {}),
  label: label.replace("Castana", "Castaña").replace("Sauco", "Saúco"),
}));
write(path.join(dir, "residents.json"), profiles);
console.log(
  kit.assets.length +
    " artworks; " +
    Object.keys(packs).length +
    " family packs; " +
    owners.size +
    " sprite names. Retired definitions (original masters kept): " +
    retired.join(", "),
);
