"use strict";
/** Offline authoring only: register the selected masters; never install or publish. */
const fs = require("node:fs"), path = require("node:path"), crypto = require("node:crypto");
const { execFileSync } = require("node:child_process");
const assert = require("node:assert/strict");
const root = path.resolve(__dirname, "..");
const args = process.argv.slice(2);
assert(args.every(a => /^--character=[a-z]+-[a-z]+$/.test(a) || a === "--enable"), "Use --character=key [--enable]");
assert.equal(args.filter(a => a.startsWith("--character=")).length, 1, "One character required");
const key = args.find(a => a.startsWith("--character=")).slice(12);
const read = p => JSON.parse(fs.readFileSync(path.join(root, p), "utf8"));
const write = (p, value) => fs.writeFileSync(path.join(root, p), JSON.stringify(value, null, 2) + "\n");
const hash = buffer => crypto.createHash("sha256").update(buffer).digest("hex");
const dir = `data/aventura/art/playable-cast/${key}`;
const config = read(`${dir}/authoring.json`);
const cataloguePath = "data/aventura/art/residents/actions/catalog.json";
const catalogue = read(cataloguePath);
const profile = read("data/aventura/art/residents/catalog.json").profiles.find(p => p.id === config.variant && p.key === key);
assert(profile && profile.source === config.reference, "The original NPC is the identity authority");
assert(catalogue.variants.includes(config.variant), "Only the explicitly selected protagonist roster");
const actions = ["run", "row", "push", "work", "carried", "needs", "discover"];
assert.deepEqual(Object.keys(config.actions).sort(), [...actions].sort(), "All seven actions are required");
const actionRoot = "data/aventura/art/residents/actions";
const referenceSha256 = hash(fs.readFileSync(path.join(root, `data/aventura/art/residents/sources/${profile.source}.png`)));
const referenceRow = catalogue.sheets.find(s => s.variant === 100 && s.action === "row");
assert(referenceRow?.sourceSeatAnchors, "Approved rowing registration must exist");
// Preflight all inputs before replacing any selected master.
const masters = actions.map(action => {
  const source = config.actions[action].source;
  assert(/^[a-z0-9-]+$/.test(source), "Source basename only");
  const image = fs.readFileSync(path.join(root, `${dir}/review/${action}.png`));
  assert(image.subarray(0, 8).equals(Buffer.from([137,80,78,71,13,10,26,10])), "PNG master required");
  const prompt = fs.readFileSync(path.join(root, `${dir}/prompts/${source}.txt`), "utf8") +
    "\nOffline preparation: scripts/prepare-playable-master.php and scripts/prepare-playable-row.php; authoring.json stores reviewed scale, seat and hand pivots. Original walking sheet remains untouched. Rowing uses exactly eight immutable seated bodies and synchronized illustrated oars.\n";
  const id = `${key}-${action}-master`;
  assert(catalogue.sheets.filter(s => s.variant === config.variant && s.action === action).length <= 1, "Duplicate action registration");
  const sheet = { id, variant: config.variant, action, sourceSha256: hash(image), promptSha256: hash(prompt), referenceSha256,
    generator: "built-in image_gen; deterministic offline composition", edgeMatte: "red", cleanFragments: .015, sourceCellWidth: 256 };
  if (action === "row") for (const field of ["sourceSeatAnchors", "occludedOars", "hullSupportedOars"])
    sheet[field] = referenceRow[field];
  return { image, prompt, id, sheet };
});
const rig = read(`${dir}/review/row-rig-source.json`), body = read(`${dir}/review/row-body-source.json`);
for (const { image, prompt, id, sheet } of masters) {
  fs.writeFileSync(path.join(root, `${actionRoot}/sources/${id}.png`), image);
  fs.writeFileSync(path.join(root, `${actionRoot}/${id}.prompt.txt`), prompt);
  const index = catalogue.sheets.findIndex(s => s.variant === config.variant && s.action === sheet.action);
  if (index < 0) catalogue.sheets.push(sheet); else catalogue.sheets[index] = sheet;
}
write(cataloguePath, catalogue);
for (const { id } of masters) execFileSync(process.env.STUDIO_PHP || "php", ["scripts/prepare-adventure-cast.php", `--sheet=${id}`], { cwd: root, stdio: "inherit" });
const ratio = read(`${actionRoot}/cutouts/${key}-row-master.json`).measurement.ratio;
assert(Number.isFinite(ratio) && ratio > 0 && ratio < 1, "Measured actor scale required");
const scale = x => {
  if (Array.isArray(x)) return x.map(scale);
  assert(Number.isFinite(x), "Finite rig coordinate required");
  return Math.round(x * ratio * 100) / 100;
};
const scaled = values => Object.fromEntries(Object.entries(values).map(([heading, points]) => [heading, scale(points)]));
const rowingPath = "data/aventura/rowing.json", rowing = read(rowingPath);
rowing.rigs[key] = scaled(rig);
rowing.bodies[key] = scaled(body);
write(rowingPath, rowing);
if (args.includes("--enable")) {
  const playerPath = "data/aventura/player-art.json", player = read(playerPath);
  player.rowingRigs[config.variant] = key;
  write(playerPath, player);
}
console.log(`${key}: seven masters and measured rowing rig registered. No build, install, save change or deployment. Review before enabling; --enable only adds the local roster entry.`);
