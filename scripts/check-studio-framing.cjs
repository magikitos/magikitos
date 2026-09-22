"use strict";
const assert = require("node:assert/strict");
const { bodyBounds, bodyView } = require("../tools/adventure-studio/body-framing");
const { ElementDoubleTap } = require("../tools/adventure-studio/element-double-tap");
const body = { solids: [[-4, -4, 8, 2], [-2, -1, 9, 1], [2, 0, 4, 1]], entrance: [-1, 1, 2, 0.5] };
for (const rotation of [0, 45, 90, 180, 270]) for (const flip of [false, true]) {
  const e = { x: 900, y: 750, scale: 1.3, rotation, flip };
  const bounds = bodyBounds(e, { anchor: [70, 130], w: 160, h: 145 }, body);
  for (const viewport of [{ width: 1150, height: 900 }, { width: 700, height: 700 }, { width: 390, height: 420 }]) {
    const { camera, zoom } = bodyView(bounds, viewport);
    assert(zoom > 0.2 && zoom <= 3);
    assert(Math.abs((bounds.x + bounds.w / 2 - camera.x) * zoom - viewport.width / 2) < 1e-8);
    assert(Math.abs((bounds.y + bounds.h / 2 - camera.y) * zoom - viewport.height / 2) < 1e-8);
    assert((bounds.x - camera.x) * zoom >= 32 - 1e-8);
    assert((bounds.y - camera.y) * zoom >= 80 - 1e-8);
    assert((bounds.x + bounds.w - camera.x) * zoom <= viewport.width - 32 + 1e-8);
    assert((bounds.y + bounds.h - camera.y) * zoom <= viewport.height - 80 + 1e-8);
  }
}
const a = { e: { id: "a" }, layer: "entities" }, b = { e: { id: "b" }, layer: "entities" };
for (const type of ["mouse", "touch", "pen"]) {
  const tap = new ElementDoubleTap(), p = { x: 100, y: 100 };
  assert(!tap.tap(a, p, 0, type)); assert(tap.tap(a, p, 100, type));
  assert(!tap.tap(a, p, 200, type)); tap.clear(); // dragging/cancelling clears history
  assert(!tap.tap(a, p, 250, type)); assert(!tap.tap(b, p, 300, type));
  assert(!tap.tap(b, p, 800, type)); assert(!tap.tap(b, { x: 130, y: 100 }, 850, type));
  assert(!tap.tap(b, { x: 130, y: 100 }, 900, "different-pointer"));
}
console.log("PASS Studio framing: compound bodies, all directions/scales, three sizes, pointer double taps.");
