"use strict";
/** Corrupt only a private module instance, then run the SAME real regression assertions. */
const assert = require("node:assert/strict"), fs = require("node:fs"), path = require("node:path"), Module = require("node:module");
const { validateSnapshots } = require("./check-forest-objects.cjs");
const filename = path.resolve(__dirname, "../public/assets/js/adventure/forest-objects.js");
const source = fs.readFileSync(filename, "utf8");
validateSnapshots();
for (const [label, before, after] of [
  ["unknown home collider", "world.setBody(entity, Boolean(record));", "world.setBody(entity, true);"],
  ["confirmed physics", "world.relocate(entity, x, y); entity.liveHidden = false;", "entity.liveHidden = false;"],
  ["visual interpolation", "(now - r.at) / protocol.limits.objectTickMs", "1"],
  ["stale scene isolation", "packet.scene !== world.data.id ||", ""],
  ["same revision cannot rewrite position", "(revision === prior.revision && (x !== prior.x || y !== prior.y))", "false"],
  ["spectator cannot push", 'live.role === "player" && entity.shared', "entity.shared"],
]) {
  assert(source.includes(before));
  const mod = new Module(filename, module); mod.filename = filename; mod.paths = Module._nodeModulePaths(path.dirname(filename));
  mod._compile(source.replace(before, after), filename);
  assert.throws(() => validateSnapshots(mod.exports.ForestObjects), { code: "ERR_ASSERTION" }, label);
  console.log("PASS negative shared client: " + label);
}
