"use strict";
/** Prove the client gates detect broken invariants. Mutations exist only in a child module
 * loader's memory; no source, browser storage or game artifact is rewritten. */
const assert = require("node:assert/strict"), path = require("node:path");
const { spawnSync } = require("node:child_process");
const root = path.resolve(__dirname, "..");
const cases = [
  ["forest-actions.js", "g.api.request(intent.endpoint, intent.request, { auth: true })",
    "g.api.request(intent.endpoint, { ...intent.request, operationId: operationId() }, { auth: true })", /2 !== 1/, "lost reply charged twice"],
  ["forest-actions.js", "&& prepare && attempt === 0", "&& attempt === 0",
    /forgotten receipt must never be rebased/, "forgotten receipt resubmitted as a new action"],
  ["forest-data.js", "text: value.text,", "text: typeof value.text === 'string' ? value.text.trim() : value.text,",
    /No rewriting or content interpretation/, "user text silently rewritten"],
  ["forest-body.js", "identity === this.key() && !abort.signal.aborted", "identity === this.key()",
    /Old GET cannot resurrect a fulfilled need/, "stale read resurrects a need"],
];
for (const [name, before, after, gate, label] of cases) {
  const target = path.join(root, "public/assets/js/adventure", name);
  const code = `
    const fs = require('node:fs'), Module = require('node:module');
    const original = Module._extensions['.js'];
    Module._extensions['.js'] = (module, filename) => {
      if (filename !== ${JSON.stringify(target)}) return original(module, filename);
      const source = fs.readFileSync(filename, 'utf8'), before = ${JSON.stringify(before)};
      if (!source.includes(before) || source.indexOf(before) !== source.lastIndexOf(before)) throw Error('Mutation target changed');
      module._compile(source.replace(before, ${JSON.stringify(after)}), filename);
    };
    require('./scripts/check-forest-notes.cjs');`;
  const result = spawnSync(process.execPath, ["-e", code], { cwd: root, encoding: "utf8", timeout: 15000 });
  assert.equal(result.status, 1, label + " must fail its actual regression check");
  assert.match(result.stderr, gate, label + " must fail for the intended invariant, not a loader error");
}
console.log("PASS 4 in-memory negative gates: duplicate charge, forgotten receipt, rewritten user text and stale body read all rejected.");
