"use strict";
/** One bounded, reproducible review of a character against every registered hull.
 * Produces evidence only. Never changes a save, default vessel or published release. */
const assert = require("node:assert/strict"), fs = require("node:fs");
const { spawn } = require("node:child_process");
const { vessels } = require("../data/aventura/rowing.json");
const { enabledVariants, defaultVariant } = require("../data/aventura/player-art.json");
const variant = Number(process.argv.find(a => a.startsWith("--variant="))?.split("=")[1] || defaultVariant);
const motion = process.argv.includes("--motion");
assert(enabledVariants.includes(variant), "Review a complete, enabled character");
assert(process.argv.slice(2).every(a => a === "--motion" || /^--variant=\d+$/.test(a)), "Unknown fleet option");
const id = JSON.parse(fs.readFileSync(".local/build/current.json")).id;
const queue = Object.keys(vessels).flatMap(vessel => ["chromium", "webkit"].map(browser => ({ vessel, browser })));
if (motion) queue.push(...Object.keys(vessels).map(vessel => ({ vessel, motion: true })));
const passed = [];
async function worker() {
  while (queue.length) {
    const job = queue.shift(), label = `fleet-${job.vessel}-${job.browser}`;
    const args = job.motion ? ["scripts/check-rowing-motion-browser.cjs"] :
      ["scripts/check-vessel-browser.cjs", `--variant=${variant}`, `--vessel=${job.vessel}`,
        `--browser=${job.browser}`, `--label=${label}`];
    await new Promise((resolve, reject) => {
      const child = spawn(process.execPath, args, { stdio: "inherit", env: {
        ...process.env, GAME_PLAYER_VARIANT: String(variant), GAME_VESSEL: job.vessel,
      } });
      child.on("error", reject);
      child.on("exit", code => code === 0 ? resolve() : reject(Error(`Fleet review failed: ${JSON.stringify(job)} (${code})`)));
    });
    assert.equal(JSON.parse(fs.readFileSync(".local/build/current.json")).id, id,
      "Do not rebuild the artifact during a fleet review");
    passed.push({ ...job, evidence: job.motion ?
      (job.vessel === "bottle" ? "game" : `${job.vessel}-game`) : label });
  }
}
(async () => {
  // Two browsers at most: mobile captures can be expensive on a development laptop.
  const results = await Promise.allSettled([worker(), worker()]);
  const failed = results.find(result => result.status === "rejected");
  if (failed) throw failed.reason;
  const file = `.local/vessel-art-reviews/${variant}/fleet.json`;
  fs.writeFileSync(file, JSON.stringify({ variant, artifact: id, motion, passed }, null, 2) + "\n");
  console.log(`PASS fleet: actor ${variant}, ${Object.keys(vessels).length} hulls, Chrome + WebKit${motion ? " + real game at three viewports" : ""}. ${file}`);
})().catch(error => { console.error(error); process.exitCode = 1; });
