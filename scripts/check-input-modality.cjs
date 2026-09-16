"use strict";
const assert = require("node:assert/strict");
const {
  InputModality,
  initiallyTouch,
} = require("../public/assets/js/adventure/input-modality");
for (const coarse of [false, true])
  for (const fine of [false, true])
    for (const points of [0, 1, 10])
      assert.equal(
        initiallyTouch(coarse, fine, points),
        coarse && !fine && points > 0,
      );
function fixture(coarse = false, fine = true, points = 0) {
  const handlers = new Map(),
    media = new Map(),
    changes = [];
  const host = {
    navigator: { maxTouchPoints: points },
    document: { addEventListener() {} },
    matchMedia(query) {
      const m = {
        matches: query.includes("coarse") ? coarse : fine,
        addEventListener(_, fn) {
          this.change = fn;
        },
      };
      media.set(query, m);
      return m;
    },
    addEventListener(name, fn) {
      handlers.set(name, fn);
    },
  };
  const modality = new InputModality((v) => changes.push(v), host);
  const emit = (name, event = {}) =>
    handlers.get(name)?.({
      isTrusted: true,
      target: { closest: () => null },
      ...event,
    });
  return { modality, emit, changes, media };
}
const { modality: m, emit, changes, media } = fixture(true, true, 10);
assert.equal(
  m.touch,
  false,
  "Hybrid with a fine pointer does not flash a joystick",
);
emit("pointerdown", {
  pointerType: "touch",
  pointerId: 1,
  sourceCapabilities: { firesTouchEvents: true },
});
assert(
  m.touch,
  "Real touch is authoritative even if capability hints disagree",
);
emit("pointermove", { pointerType: "mouse", movementX: 8 });
assert(m.touch, "Mouse drift cannot interrupt a held thumb");
emit("pointerup", { pointerId: 1 });
emit("pointermove", {
  pointerType: "mouse",
  movementX: 2,
  sourceCapabilities: { firesTouchEvents: true },
});
assert(m.touch);
emit("pointermove", { pointerType: "mouse", movementX: 0, movementY: 0 });
assert(m.touch, "Layout/hover without motion is not mouse use");
emit("pointermove", { pointerType: "mouse", movementX: 3 });
assert(!m.touch);
for (let i = 0; i < 3; i++) {
  emit("pointerdown", { pointerType: "touch", pointerId: 2 });
  assert(m.touch);
  emit("pointercancel", { pointerId: 2 });
  emit("keydown", { key: "ArrowUp" });
  assert(!m.touch, "Repeated switching, not once listeners");
}
emit("pointerdown", { pointerType: "touch", pointerId: 3 });
emit("pointerup", { pointerId: 3 });
for (const event of [
  { key: "a", target: { closest: () => ({}) } },
  { key: "a", isComposing: true },
  { key: "Process" },
  { key: "Control" },
]) {
  emit("keydown", event);
  assert(m.touch, "Typing/composition in native forms leaves touch available");
}
emit("pointerdown", { pointerType: "pen", pointerId: 4 });
assert(!m.touch);
emit("pointerdown", { pointerType: "touch", isTrusted: false });
assert(!m.touch, "Synthetic scripts do not choose the input mode");
const count = changes.length;
emit("pointermove", { pointerType: "mouse", movementX: 4 });
assert.equal(changes.length, count, "No DOM work on every mouse move");
media.get("(any-pointer: fine)").matches = false;
media.get("(any-pointer: fine)").change();
assert(!m.touch, "Capabilities cannot override observed user input");
const initial = fixture(true, true, 5),
  fine = initial.media.get("(any-pointer: fine)");
fine.matches = false;
fine.change();
assert(
  initial.modality.touch,
  "Removing a fine pointer updates an unused initial estimate",
);
initial.emit("pointerdown", { pointerType: "touch", pointerId: 5 });
initial.emit("blur");
assert.equal(initial.modality.touches.size, 0);
console.log(
  "PASS input modality: conservative initial/hybrid estimate, dynamic repeated switching, trusted pointer sources, synthesized mouse immunity, active-touch arbitration, keyboard/form priority and capability updates.",
);
