"use strict";
const assert = require("node:assert/strict"),
  fs = require("node:fs"),
  crypto = require("node:crypto");
const { execFileSync } = require("node:child_process");
const { World, TILE } = require("../public/assets/js/adventure/model");
const { createNeighbors } = require("../public/assets/js/adventure/neighbors");
const { ZoneCasting } = require("../public/assets/js/adventure/casting");
const { SceneDirector } = require("../public/assets/js/adventure/scenes");
const { Presentation } = require("../public/assets/js/adventure/presentation");
const { cleanSave } = require("../public/assets/js/adventure/save");
const { planReaction } = require("../public/assets/js/adventure/rules");
const { familyOf } = require("../public/assets/js/adventure/elements");
const {
  doorDestination,
  portalArrival,
} = require("../public/assets/js/adventure/portals");
const catalog = JSON.parse(
  execFileSync(
    "php",
    ["-r", 'echo json_encode(require "data/aventura/world.php");'],
    { encoding: "utf8" },
  ),
);
const profiles = catalog.avatarProfiles,
  source = require("../data/aventura/art/residents/catalog.json");
const manifest = require("../public/assets/aventura/manifest.json"),
  owners = new Map();
for (const [id, p] of Object.entries(manifest.packs))
  for (const sprite of p.sprites) owners.set(sprite, id);
assert.equal(profiles.length, 100);
assert.equal(new Set(profiles.map((p) => p.id)).size, 100);
assert.equal(profiles.filter((p) => p.gender === "female").length, 50);
assert.equal(profiles.filter((p) => p.gender === "male").length, 50);
assert.equal(new Set(profiles.map((p) => p.family)).size, 20);
assert.deepEqual(
  profiles.map(({ id, key, family, gender }) => ({ id, key, family, gender })),
  source.profiles.map(({ id, key, family, gender }) => ({
    id,
    key,
    family,
    gender,
  })),
  "Runtime identities derive from the authored catalog",
);
for (const edition of require("../data/aventura/art/doorways/catalog.json")
  .assets) {
  const owner = owners.get(edition.id);
  assert(owner, "Door edition is registered: " + edition.id);
  const frames = JSON.parse(
    fs.readFileSync("data/aventura/assets/" + owner + ".json"),
  ).frames;
  assert.equal(
    frames[edition.id].source,
    edition.cutout,
    "Open art cannot revert to a closed original",
  );
  const report = JSON.parse(
    fs.readFileSync(edition.cutout.replace(/\.png$/, ".json")),
  );
  for (const [field, file] of [
    ["sourceHash", edition.source],
    ["referenceHash", edition.reference],
  ])
    assert.equal(
      report[field],
      crypto.createHash("sha256").update(fs.readFileSync(file)).digest("hex"),
    );
}
const hashes = source.profiles.map((p) =>
  crypto
    .createHash("sha256")
    .update(
      fs.readFileSync(`data/aventura/art/residents/sources/${p.source}.png`),
    )
    .digest("hex"),
);
assert.equal(
  new Set(hashes).size,
  100,
  "100 independently drawn masters, not copies counted as profiles",
);
const cast = new ZoneCasting(profiles),
  chosen = [];
for (let i = 0; i < 20; i++)
  chosen.push(cast.choose("same-preference", "test-zone"));
assert.equal(
  new Set(chosen.map((id) => profiles.find((p) => p.id === id).family)).size,
  20,
);
assert.throws(() => cast.choose("overflow", "test-zone"), /exhausted/);
assert.equal(
  new ZoneCasting(profiles).choose("author", "a"),
  new ZoneCasting(profiles).choose("author", "b"),
);
for (const data of Object.values(catalog.scenes)) {
  const w = new World(data);
  const cast = createNeighbors(
    w,
    { world: catalog, cast: {} },
    [],
    () => 0.999,
  );
  const zones = new Map();
  for (const n of cast) {
    assert(
      w.canStand(n.x, n.y),
      data.id + ": resident stands on free land " + n.id,
    );
    const zone = w.region(n.home.x / TILE, n.home.y / TILE),
      ids = zones.get(zone) || new Set(),
      family = profiles.find((p) => p.id === n.variant).family;
    assert(!ids.has(family), data.id + ": no repeated silhouette in " + zone);
    ids.add(family);
    zones.set(zone, ids);
  }
  for (const e of w.entities)
    if (familyOf(e)?.entrance === "open") {
      assert(
        e.portal && e.threshold,
        e.id + ": open artwork has a real doorway",
      );
      assert(
        e.rules.some((r) => r.effects.some((f) => f.type === "travel")),
        e.id + ": doorway leads somewhere",
      );
    }
}
assert(!catalog.flags.includes("introSeen"));
for (const portal of catalog.scenes.islet.entities.filter((e) => e.portal)) {
  const entry = portal.rules
      .flatMap((r) => r.effects)
      .find((e) => e.type === "travel"),
    room = catalog.scenes[entry.scene];
  const exit = room.entities.find((e) => e.id === "exit"),
    travel = exit.rules
      .flatMap((r) => r.effects)
      .find((e) => e.type === "travel");
  assert.deepEqual(
    doorDestination(catalog, room, exit, travel, {
      scene: "islet",
      portal: portal.id,
    }),
    { scene: "islet", position: portalArrival(catalog, "islet", portal.id) },
    "Shared interiors return to their actual island doorway",
  );
  assert.equal(
    doorDestination(catalog, room, exit, travel, {
      scene: "islet",
      portal: "missing",
    }).scene,
    travel.scene,
    "Deleted entrances use their safe authored fallback",
  );
}
assert.equal(catalog.scenes.overworld.waters.length, 0);
assert.equal(catalog.scenes.overworld.rivers.length, 0);
assert(
  !catalog.scenes.overworld.entities.some(
    (e) => e.id === "human-picnic-basket",
  ),
);
const islet = new World(catalog.scenes.islet),
  arch = islet.entities.find((e) => e.id === "garden-trellis");
assert(islet.canStand(arch.x, arch.y), "Walk underneath the arch");
for (const x of [-1.8, 1.7])
  assert(!islet.canStand(arch.x + x * TILE, arch.y), "Arch posts are solid");
(async () => {
  for (const data of Object.values(catalog.scenes)) {
    const requests = new Set(),
      game = {
        catalog,
        config: { world: catalog, cast: {} },
        cast: [],
        renderer: {
          sprites: {
            prepare: async (names, packs) => {
              for (const name of names) {
                assert(owners.has(name), "Sprite owner: " + name);
                requests.add(owners.get(name));
              }
              for (const id of packs) {
                assert(manifest.packs[id], "Pack exists: " + id);
                requests.add(id);
              }
              return requests;
            },
          },
        },
      };
    const director = new SceneDirector(game);
    await director.prepare(
      data.id,
      { x: data.spawn.x * TILE, y: data.spawn.y * TILE },
      cleanSave(null, catalog),
    );
    const residents = [...requests].filter((id) => /^actor-1\d\d$/.test(id));
    assert(
      residents.length < 25,
      "No scene downloads the whole resident library",
    );
    const bytes = [...requests].reduce(
      (sum, id) =>
        sum +
        fs.statSync("public/assets/aventura/" + manifest.packs[id].image).size,
      0,
    );
    assert(bytes < 4000000, data.id + ": bounded scene load " + bytes);
    console.log(
      data.id +
        ": " +
        residents.length +
        " resident packs, " +
        Math.round(bytes / 1024) +
        " KB scene textures",
    );
  }
  const w = new World(catalog.scenes.overworld),
    before = cleanSave(null, catalog),
    item = w.entities.find((e) => e.id === "picnic-mushroom"),
    after = planReaction(item, before, catalog).state;
  const presentation = new Presentation({ catalog });
  let reject;
  presentation.play = () =>
    new Promise((_, fail) => {
      reject = fail;
    });
  const pending = presentation.gains(before, after, item);
  assert(
    presentation.hides(item),
    "Source hidden immediately, before gesture resources resolve",
  );
  assert(
    !before.inventory.mushroom,
    "Visual pickup does not prematurely grant inventory",
  );
  reject(new Error("test cancellation"));
  await assert.rejects(pending, /cancellation/);
  presentation.finish();
  assert(!presentation.hides(item), "Cancelled pickup restores its source");
  console.log(
    "PASS: 100 complete identities, natural balanced cast, no repeated zone silhouettes, all open doors enterable, bounded lazy scenes, compound arch and atomic pickup visibility.",
  );
})().catch((e) => {
  console.error(e);
  process.exitCode = 1;
});
