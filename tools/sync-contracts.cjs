"use strict";
/**
 * The website owns the two shared contracts (the world API and the live-forest protocol); this
 * repository carries byte-identical copies so the game builds and tests on its own. Copying
 * them by hand is how they drifted: `npm run sync:contracts` takes them from the sibling
 * website checkout, `--check` only reports. Without the sibling there is nothing to compare.
 */
const fs = require("node:fs");
const path = require("node:path");
const CONTRACTS = ["docs/world-api.openapi.json", "docs/forest-protocol.json"];
const root = path.resolve(__dirname, ".."),
  website = path.resolve(root, process.env.MAGIKITOS_WEBSITE || "../magikitos");
const check = process.argv.includes("--check");
if (!fs.existsSync(path.join(website, "docs"))) {
  console.log("SKIP contracts: no website checkout at " + website);
  process.exit(0);
}
let stale = 0;
for (const file of CONTRACTS) {
  const source = fs.readFileSync(path.join(website, file)),
    target = path.join(root, file);
  if (fs.existsSync(target) && fs.readFileSync(target).equals(source)) continue;
  stale++;
  if (check) console.error("STALE " + file + ": run npm run sync:contracts");
  else {
    fs.writeFileSync(target, source);
    console.log("synced " + file);
  }
}
if (check && stale) process.exit(1);
if (!stale) console.log("contracts in sync");
