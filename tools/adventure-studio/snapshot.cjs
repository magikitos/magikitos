"use strict";
const fs = require("node:fs"),
  path = require("node:path"),
  crypto = require("node:crypto"),
  cp = require("node:child_process");
const { World, TILE } = require("../../public/assets/js/adventure/model");
const {
  resolveAppearance,
} = require("../../public/assets/js/adventure/elements");
const hash = (value) => crypto.createHash("sha256").update(value).digest("hex");
function snapshot(root) {
  const dir = path.join(root, "data/aventura"),
    sources = {};
  const world = JSON.parse(
    cp.execFileSync(
      process.env.STUDIO_PHP || "php",
      [
        "-r",
        "echo json_encode(require $argv[1], JSON_THROW_ON_ERROR);",
        path.join(dir, "world.php"),
      ],
      { maxBuffer: 8 * 1024 * 1024, encoding: "utf8" },
    ),
  );
  // Edit each authored template once; guest instances and moored vessels are derived data.
  const instances = JSON.parse(
    fs.readFileSync(path.join(dir, "scene-instances.json")),
  );
  for (const id of Object.keys(instances)) delete world.scenes[id];
  for (const scene of Object.values(world.scenes))
    scene.entities = scene.entities
      .filter((e) => !e.generated)
      .map((e) => resolveAppearance(e, scene.id));
  const scenery = {};
  for (const [id, scene] of Object.entries(world.scenes)) {
    const text = fs.readFileSync(
      path.join(dir, "scenes", id + ".json"),
      "utf8",
    );
    sources[id] = { data: JSON.parse(text), hash: hash(text) };
    scenery[id] = new World(scene).props.map((e) => ({
      ...e,
      x: e.x / TILE,
      y: e.y / TILE,
      ...(e.id.startsWith("tree-")
        ? { solid: e.solid || [-0.5, -0.5, 1, 1] }
        : {}),
    }));
  }
  const manifest = fs.readFileSync(
    path.join(root, "public/assets/aventura/manifest.json"),
    "utf8",
  );
  const sprites = {};
  for (const file of fs
    .readdirSync(path.join(dir, "assets"))
    .filter((f) => f.endsWith(".json"))) {
    const source = fs.readFileSync(path.join(dir, "assets", file), "utf8"),
      pack = JSON.parse(source);
    for (const [name, definition] of Object.entries(pack.frames || {})) {
      if (name.startsWith("person-") && !/^person-1\d\d-down$/.test(name))
        continue;
      sprites[name] = {
        file: "data/aventura/assets/" + file,
        sourceHash: hash(source),
        definition,
      };
    }
  }
  const baseHash = hash(JSON.stringify({ world, sources, manifest, sprites }));
  return {
    baseHash,
    createdAt: new Date().toISOString(),
    world,
    sources,
    scenery,
    sprites,
  };
}
module.exports = { snapshot, hash };
