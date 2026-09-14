"use strict";
const assert = require("node:assert/strict"),
  fs = require("node:fs"),
  os = require("node:os"),
  path = require("node:path");
const { execFileSync } = require("node:child_process");
const { paintGround } = require("../public/assets/js/adventure/ground");
const { portalArrival } = require("../public/assets/js/adventure/portals");
const { cleanSave } = require("../public/assets/js/adventure/save");
const catalog = JSON.parse(fs.readFileSync(".local/build/world.json"));

// The earth's core stays one tone through procedural variation and chunk boundaries.
const data = {
  seed: 7319,
  width: 64,
  height: 32,
  paths: [
    [
      [0, 8],
      [64, 8],
    ],
  ],
};
for (const ox of [0, 256, 512]) {
  let pixels;
  paintGround(
    {
      createImageData: (w, h) => ({ data: new Uint8ClampedArray(w * h * 4) }),
      putImageData: (image) => (pixels = image.data),
    },
    { data },
    ox,
    0,
  );
  for (let y = 124; y <= 132; y++)
    for (let x = 0; x < 256; x++)
      assert.deepEqual(
        [...pixels.slice((y * 256 + x) * 4, (y * 256 + x) * 4 + 4)],
        [206, 187, 136, 255],
        "No light islands in the path's core",
      );
}

for (const [scene, id] of Object.entries({
  house: "human-door",
  cottage: "home-one",
  tavern: "tavern-door",
  workshop: "workshop-door",
})) {
  const raw = JSON.parse(
    fs.readFileSync("data/aventura/scenes/" + scene + ".json"),
  );
  const source = raw.entities
    .find((e) => e.id === "exit")
    .rules.flatMap((r) => r.effects)
    .find((e) => e.type === "travel");
  assert.equal(source.arrivalAt, id);
  assert(
    !Object.hasOwn(source, "x") && !Object.hasOwn(source, "y"),
    "No duplicate exterior coordinates",
  );
  const exit = catalog.scenes[scene].entities
    .find((e) => e.id === "exit")
    .rules.flatMap((r) => r.effects)
    .find((e) => e.type === "travel");
  assert.deepEqual(
    { x: exit.x * 16, y: exit.y * 16 },
    portalArrival(catalog, "overworld", id),
  );
}
const entrance = { scene: "overworld", portal: "human-door" };
const save = cleanSave(
  {
    scene: "house",
    entrance,
    flags: { introSeen: true },
    inventory: { lighter: 1 },
  },
  catalog,
);
assert.deepEqual(save.entrance, entrance);
assert.equal(save.inventory.lighter, 1);
assert.equal(portalArrival(catalog, "__proto__", "human-door"), null);
assert.equal(portalArrival(catalog, "overworld", "missing"), null);
assert.equal(
  cleanSave({ entrance: { scene: "overworld", portal: "missing" } }, catalog)
    .entrance,
  undefined,
);
assert.equal(
  cleanSave(
    { entrance: { scene: "overworld", position: { x: 50, y: 50 } } },
    catalog,
  ).entrance,
  undefined,
);

// Move a building in an isolated source copy: both a compiled exit and a resumed save follow it.
const temp = fs.mkdtempSync(
  path.join(os.tmpdir(), "magikitos-portal-fixture-"),
);
try {
  fs.mkdirSync(path.join(temp, "data/aventura"), { recursive: true });
  fs.mkdirSync(path.join(temp, "src"));
  for (const item of ["world.php", "catalog.json", "scenes", "behaviors"])
    fs.cpSync("data/aventura/" + item, path.join(temp, "data/aventura", item), {
      recursive: true,
    });
  fs.copyFileSync(
    "src/adventure-geometry.php",
    path.join(temp, "src/adventure-geometry.php"),
  );
  const file = path.join(temp, "data/aventura/scenes/overworld.json"),
    scene = JSON.parse(fs.readFileSync(file));
  const house = scene.entities.find((e) => e.id === "human-door");
  house.x += 0.25;
  house.y += 1;
  fs.writeFileSync(file, JSON.stringify(scene));
  const compile = () =>
    JSON.parse(
      execFileSync(
        "php",
        [
          "-r",
          "echo json_encode(require $argv[1]);",
          path.join(temp, "data/aventura/world.php"),
        ],
        { encoding: "utf8", stdio: ["ignore", "pipe", "pipe"] },
      ),
    );
  const moved = compile(),
    point = portalArrival(moved, save.entrance.scene, save.entrance.portal),
    before = portalArrival(catalog, entrance.scene, entrance.portal);
  assert.deepEqual(point, { x: before.x + 4, y: before.y + 16 });
  const exit = moved.scenes.house.entities.find((e) => e.id === "exit").rules[0]
    .effects[0];
  assert.deepEqual(point, { x: exit.x * 16, y: exit.y * 16 });
  const roomFile = path.join(temp, "data/aventura/scenes/house.json"),
    room = JSON.parse(fs.readFileSync(roomFile));
  room.entities.find((e) => e.id === "exit").rules[0].effects[0].arrivalAt =
    "missing";
  fs.writeFileSync(roomFile, JSON.stringify(room));
  assert.throws(compile, /portal arrival/);
} finally {
  fs.rmSync(temp, { recursive: true, force: true });
}
console.log(
  "PASS: uniform path core; source-linked exits; relocated building round trips; saved portal IDs; rejected missing anchors.",
);
