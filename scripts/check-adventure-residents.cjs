"use strict";
const assert = require("node:assert/strict"),
  fs = require("node:fs"),
  crypto = require("node:crypto");
const { execFileSync } = require("node:child_process");
const { World, TILE } = require("../public/assets/js/adventure/model");
const { createNeighbors } = require("../public/assets/js/adventure/neighbors");
const { ZoneCasting } = require("../public/assets/js/adventure/casting");
const { SceneDirector } = require("../public/assets/js/adventure/scenes");
const { composeLocales } = require("../tools/locales.cjs");
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
const copy = composeLocales(catalog);
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
      family = profiles.find((p) => p.id === n.variant)?.family || (n.variant===12?"named-elder":null);
    assert(family,"Resident belongs to the repertoire or is the named elder");
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
// Un interior devuelve a la puerta por la que se entró, y una puerta que ya no existe cae al
// destino escrito a mano. Se barre el EMBARCADERO, que es donde viven hoy todas las puertas del
// bosque: las del islote se fueron con él, y la regla es la misma para cualquier pantalla.
for (const portal of catalog.scenes.overworld.entities.filter((e) => e.portal)) {
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
      scene: "overworld",
      portal: portal.id,
    }),
    {
      scene: "overworld",
      position: portalArrival(catalog, "overworld", portal.id),
    },
    "Interiors return to the doorway you actually walked through",
  );
  assert.equal(
    doorDestination(catalog, room, exit, travel, {
      scene: "overworld",
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
// El arco del huerto se mudó con la vida del islote a la pradera de los sauces.
const meadow = new World(catalog.scenes["river-willows"]),
  arch = meadow.entities.find((e) => e.id === "meadow-garden-trellis");
assert(meadow.canStand(arch.x, arch.y), "Walk underneath the arch");
for (const x of [-1.8, 1.7])
  assert(!meadow.canStand(arch.x + x * TILE, arch.y), "Arch posts are solid");
(async () => {
  for (const data of Object.values(catalog.scenes)) {
    const requests = new Set(),
      asked = [],
      game = {
        catalog,
        config: { world: catalog, cast: {} },
        cast: [],
        // Lo que dice la pantalla se pide junto a sus sprites, así que el doble de prueba lo
        // sirve igual que el de verdad: de ahí sale el aviso si algún día deja de pedirse.
        sceneText: {
          load: async (id) => {
            asked.push(id);
            return copy.scenes[id].es;
          },
        },
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
    const prepared = await director.prepare(
      data.id,
      { x: data.spawn.x * TILE, y: data.spawn.y * TILE },
      cleanSave(null, catalog),
    );
    assert.deepEqual(asked, [data.id], data.id + ": pide su copia una vez y solo la suya");
    assert.deepEqual(
      prepared.strings,
      copy.scenes[data.id].es,
      data.id + ": llega con lo que esa pantalla dice",
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
    before = cleanSave({inventory:{knife:1}}, catalog),
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
  /**
   * ⛔ PRECARGAR LAS VECINAS ES UN FAVOR, NO UNA EXCUSA PARA RESERVAR EL BOSQUE ENTERO.
   *
   * Desde el 17-sep-2026 el juego calienta las pantallas que tocan a la que estás, así que lo que
   * hay en memoria ya no es UNA escena: es la tuya más sus vecinas más próximas. Eso tiene que
   * seguir cabiendo en un teléfono, y sin un techo no cabe — el bosque tiene ocho puertas. Aquí
   * se mide el caso PEOR de verdad: cada escena con las tres vecinas más caras que podría tener.
   */
  {
    const { SceneDirector } = require("../public/assets/js/adventure/scenes");
    const director = new SceneDirector({ catalog });
    const bytes = (id) =>
      fs.statSync("public/assets/aventura/" + manifest.packs[id].image).size;
    const weigh = (id) => sceneWeights[id] || 0;
    const sceneWeights = {};
    for (const [id, data] of Object.entries(catalog.scenes)) {
      const packs = new Set();
      for (const sprite of [...data.entities, ...(data.scenery || [])])
        if (sprite.sprite && owners.has(sprite.sprite)) packs.add(owners.get(sprite.sprite));
      sceneWeights[id] = [...packs].reduce((sum, pack) => sum + bytes(pack), 0);
    }
    let peor = 0,
      culpable = null;
    for (const [id, data] of Object.entries(catalog.scenes)) {
      const ways = director.neighbours(data);
      // Lo que declaran los datos y nada más: ni una lista escrita a mano que caduque.
      const declared = new Set();
      for (const entity of data.entities)
        for (const rule of entity.rules || [])
          for (const effect of rule.effects || [])
            if (effect.type === "travel") declared.add(effect.scene);
      for (const exit of data.navigation?.exits || []) declared.add(exit.scene);
      assert.deepEqual(
        new Set(ways.map((w) => w.id)),
        declared,
        id + ": las vecinas salen de los datos",
      );
      for (const way of ways)
        assert(
          Number.isFinite(way.x) && Number.isFinite(way.y),
          id + "/" + way.id + ": sin saber por dónde se va no se puede ordenar la precarga",
        );
      const peores = [...declared]
        .map(weigh)
        .sort((a, b) => b - a)
        .slice(0, 3)
        .reduce((sum, n) => sum + n, 0);
      const total = weigh(id) + peores;
      if (total > peor) {
        peor = total;
        culpable = id;
      }
    }
    assert(
      peor < 12000000,
      "Precarga desbocada en " + culpable + ": " + Math.round(peor / 1024) + " KB",
    );
    console.log(
      "  precarga acotada: peor caso " +
        culpable +
        " con sus tres vecinas más caras, " +
        Math.round(peor / 1024) +
        " KB",
    );
  }
  console.log(
    "PASS: 100 complete identities, natural balanced cast, no repeated zone silhouettes, all open doors enterable, bounded lazy scenes, bounded preloading, compound arch and atomic pickup visibility.",
  );
})().catch((e) => {
  console.error(e);
  process.exitCode = 1;
});
