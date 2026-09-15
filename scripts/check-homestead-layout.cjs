"use strict";
const assert = require("node:assert/strict"),
  path = require("node:path"),
  fs = require("node:fs"),
  cp = require("node:child_process");
const { gameContract } = require("../tools/game-contract.cjs");
const {
  validateLayout,
} = require("../public/assets/js/adventure/homestead-layout");
const { World, TILE } = require("../public/assets/js/adventure/model");
const root = path.resolve(__dirname, "..");
const world = JSON.parse(
  cp.execFileSync("php", [
    "-r",
    "echo json_encode(require $argv[1]);",
    path.join(root, "data/aventura/world.php"),
  ]),
);
const { homesteads: catalog } = gameContract(world);
const cases = [],
  clone = (v) => JSON.parse(JSON.stringify(v));
function check(layout, error = null) {
  let actual = null;
  try {
    validateLayout(layout, catalog);
  } catch (e) {
    actual = e.message;
  }
  assert.equal(actual, error);
  cases.push({ layout, error });
}
check(catalog.initial);
check({ objects: [] });
// Authored editable rectangles are inscribed in the actual dry ground/floor,
// not the whole bounding rectangle around an island or rounded room.
for (const [space, scene] of [
  ["garden", "home-garden"],
  ["room", "home-room"],
]) {
  const model = new World(world.scenes[scene]),
    [x, y, w, h] = catalog.spaces[space].editable;
  for (let py = y; py <= y + h; py += 0.5)
    for (let px = x; px <= x + w; px += 0.5)
      assert(
        model.terrainCanStand(px * TILE, py * TILE),
        `${space}: editable ground ${px},${py} must be dry floor`,
      );
}
for (const [kind, spec] of Object.entries(catalog.stock))
  for (const variant of spec.variants)
    check({
      objects: [
        {
          id: "test",
          kind,
          variant: variant.id,
          space: spec.spaces[0],
          x: 14,
          y: 10,
        },
      ],
    });
const initial = () => clone(catalog.initial);
let v = initial();
v.objects[0].id = v.objects[1].id;
check(v, "invalid_object");
v = initial();
v.objects[0].kind = "__proto__";
check(v, "invalid_kind");
v = initial();
v.objects[0].variant = "unregistered";
check(v, "invalid_kind");
v = initial();
v.objects[0].x = 0;
check(v, "outside_plot");
v = initial();
v.objects[0].x = 7.3;
check(v, "invalid_position");
v = initial();
v.objects[0].x = 12;
v.objects[0].y = 15;
check(v, "protected_access");
v = initial();
v.objects[0].script = "alert(1)";
check(v, "invalid_object");
v = initial();
v.objects.push({ ...v.objects[0], id: "other-bed" });
check(v, "stock_exceeded");
v = initial();
v.objects[2].x = 17;
v.objects[2].y = 8;
check(v, "objects_overlap");
v = initial();
v.objects[0].space = "garden";
check(v, "invalid_kind");
// Optional cross-repo parity: no runtime dependency, no PHP/backend code copied into the game.
const web = process.env.GAME_TEST_WEB_ROOT;
if (web) {
  const results = JSON.parse(
    cp.execFileSync("php", [path.join(web, "scripts/check-game-layout.php")], {
      input: JSON.stringify({ catalog, cases }),
    }),
  );
  assert.deepEqual(
    results,
    cases.map((c) => c.error),
  );
}
console.log(
  `${cases.length} homestead placement cases PASS${web ? "; PHP/JS parity PASS" : ""}`,
);
