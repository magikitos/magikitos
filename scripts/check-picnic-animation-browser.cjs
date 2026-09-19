"use strict";
/** Real browser raster QA using the production renderer and baked native frames. */
const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");
const { buildSync } = require("esbuild");
const { chromium } = require("playwright");
const { clips: ambientClips } = require("../public/assets/js/adventure/ambient-actors");
const { seatedClip } = require("../public/assets/js/adventure/seating");
const { DIRECTIONS } = require("../public/assets/js/adventure/characters");
const clips = { ...ambientClips, ...Object.fromEntries(DIRECTIONS.flatMap(d => [0,2].map(p => {
  const name=`person-12-${d}-sit-${p}`; return [name,seatedClip(name)];
}))) };
const origin = process.env.GAME_ORIGIN || "http://127.0.0.1:47834";
(async () => {
  const browser = await chromium.launch({ channel: "chrome", headless: true });
  try {
    const page = await browser.newPage({
      viewport: { width: 1000, height: 700 },
      bypassCSP: true,
    });
    const errors = [];
    page.on("pageerror", (e) => errors.push(e.message));
    await page.route("**/*", (r) =>
      ["127.0.0.1", "magikitos.ddev.site"].includes(
        new URL(r.request().url()).hostname,
      )
        ? r.continue()
        : r.abort(),
    );
    await page.addInitScript(() =>
      localStorage.setItem(
        "magikitos.adventure",
        JSON.stringify({
          scene: "overworld",
          position: { x: 25 * 16, y: 52.5 * 16 },
          flags: {  },
          muted: true,
        }),
      ),
    );
    await page.goto(origin + "/bosque/explorar");
    await require("./browser-entry.cjs").enterWorld(page);
    const bundle = buildSync({
      stdin: {
        contents:
          'module.exports = { ...require("./public/assets/js/adventure/ambient-actors"), ...require("./public/assets/js/adventure/sprites"), clips: ' + JSON.stringify(clips) + ' };',
        resolveDir: process.cwd(),
      },
      bundle: true,
      format: "iife",
      globalName: "PicnicQA",
      write: false,
    }).outputFiles[0].text;
    await page.addScriptTag({ content: bundle });
    const result = await page.evaluate(async () => {
      const lib = new PicnicQA.SpriteLibrary();
      const url = performance
        .getEntriesByType("resource")
        .find((r) => r.name.endsWith("/aventura/manifest.json")).name;
      await lib.initialize(url);
      await lib.prepare(Object.keys(PicnicQA.clips));
      const hash = (bytes) => {
        let n = 2166136261;
        for (const byte of bytes) n = Math.imul(n ^ byte, 16777619);
        return n >>> 0;
      };
      const result = [];
      const contact = document.createElement("canvas");
      contact.width = 512;
      contact.height = Object.keys(PicnicQA.clips).length * 200;
      const preview = contact.getContext("2d");
      preview.fillStyle = "#708c53";
      preview.fillRect(0, 0, contact.width, contact.height);
      for (const [name, clip] of Object.entries(PicnicQA.clips)) {
        const canvas = document.createElement("canvas");
        canvas.width = 256;
        canvas.height = 200;
        // Raster assertions read every pose back. Choose one backend up front:
        // Chrome otherwise switches GPU→CPU after the first getImageData calls,
        // changing nearest-neighbor half-pixel ties even for identical artwork.
        const ctx = canvas.getContext("2d", { willReadFrequently: true });
        const frames = new Map();
        let baseline;
        // Sample every timeline pose. Smoke stays above the fixed lower-body seam;
        // its timing and reduced-motion suppression are tested by the pure suite.
        for (let t = 0; t < 20; t += 0.04) {
          const p = PicnicQA.pose(clip, t);
          if (frames.has(p.frame)) continue;
          ctx.clearRect(0, 0, 256, 200);
          PicnicQA.drawAmbientActor(ctx, lib, { x: 128, y: 150 }, name, t);
          PicnicQA.drawAmbientActor(
            preview,
            lib,
            { x: 64 + frames.size * 128, y: 150 + result.length * 200 },
            name,
            t,
          );
          const lowerPixels = ctx.getImageData(0, 150 + clip.fixedBelow, 256, 200 - 150 - clip.fixedBelow).data;
          baseline ||= lowerPixels.slice();
          const differences = [];
          for (let i = 0; i < lowerPixels.length; i += 4) {
            if (lowerPixels.slice(i, i + 4).some((value, channel) => value !== baseline[i + channel]))
              differences.push([i / 4 % 256, Math.floor(i / 4 / 256) + 150 + clip.fixedBelow, [...baseline.slice(i, i + 4)], [...lowerPixels.slice(i, i + 4)]]);
          }
          frames.set(p.frame, {
            differences: differences.slice(0, 8),
            lower: hash(
              ctx.getImageData(
                0,
                150 + clip.fixedBelow,
                256,
                200 - 150 - clip.fixedBelow,
              ).data,
            ),
            upper: hash(
              ctx.getImageData(0, 0, 256, 150 + clip.fixedBelow).data,
            ),
          });
        }
        const owners = [
          ...new Set(clip.steps.map(([frame]) => lib.packageFor(frame))),
        ];
        result.push({ name, frames: [...frames], owners });
      }
      const native = Object.values(lib.manifest.packs).filter((p) =>
        p.sprites.includes("picnic-smoker"),
      );
      return {
        actors: result,
        packs: native.length,
        contact: contact.toDataURL("image/png"),
      };
    });
    const output = path.resolve(".local/picnic-review");
    fs.mkdirSync(output, { recursive: true });
    fs.writeFileSync(path.join(output, "rendered-poses.png"), Buffer.from(result.contact.split(",")[1], "base64"));
    delete result.contact;
    fs.writeFileSync(path.join(output, "animation-report.json"), JSON.stringify(result, null, 2) + "\n");
    for (const a of result.actors) {
      assert.equal(
        a.owners.length,
        1,
        "Every pose arrives in the idle sprite's scene-lazy pack",
      );
      assert.equal(
        a.frames.length,
        new Set(clips[a.name].steps.map(([f]) => f)).size,
      );
      assert.equal(
        new Set(a.frames.map(([, f]) => f.lower)).size,
        1,
        a.name + ": seated legs and feet stay pixel-identical",
      );
      assert.equal(
        new Set(a.frames.map(([, f]) => f.upper)).size,
        a.frames.length,
        "Every authored upper-body pose is distinct",
      );
    }
    assert.deepEqual(errors, []);
    await page.close();
    console.log(
      "PASS: browser-rendered authored gestures, pixel-identical stationary feet, shared lazy animation pack, no JS errors.",
    );
  } finally {
    await browser.close();
  }
})().catch((e) => {
  console.error(e);
  process.exitCode = 1;
});
