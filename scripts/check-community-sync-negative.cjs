"use strict";
const assert = require("node:assert/strict"), fs = require("node:fs"), path = require("node:path"), Module = require("node:module");
const { run } = require("./check-community-sync.cjs");
const file = path.join(__dirname, "../public/assets/js/adventure/community-sync.js"), source = fs.readFileSync(file, "utf8");
function load(code) { const m = new Module(file, module); m.filename = file; m.paths = Module._nodeModulePaths(path.dirname(file)); m._compile(code, file); return m.exports.CommunitySync; }
async function main() {
  await run(load(source));
  for (const [label, before, after] of [
    ["one in-flight request", "this.loading || this.now()", "false || this.now()"],
    ["latest revision coalescing", "Math.max(packet.revision,", "Math.min(packet.revision,"],
    ["own mutation isolation", "g.transitioning || c.busy", "g.transitioning"],
    ["old lifecycle cannot finish the new fetch", "if (epoch === this.epoch) { this.loading = false;", "if (true) { this.loading = false;"],
    ["wrong-zone HTTP response", 'if (snapshot?.zone !== zone) throw Error("invalid_community_zone");', ""],
    ["account-scoped ownership cache", "this.community.snapshots.clear();", ""],
  ]) {
    assert(source.includes(before), "Missing mutation target: " + label);
    await assert.rejects(run(load(source.replace(before, after))), undefined, "Gate missed: " + label);
    console.log("PASS negative community synchronization: " + label);
  }
}
main().catch(e => { console.error(e); process.exitCode = 1; });
