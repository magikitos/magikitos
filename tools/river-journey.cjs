"use strict";
const { mainChannel, riverSection } = require("../public/assets/js/adventure/river-course");
const { layoutScenes } = require("../public/assets/js/adventure/world-layout");
/** One continuous resident follows the authored banks, including the lake, in both directions.
 * Compile the circuit once; the runtime only samples its arc length and local scene offset. */
function prepareRiverJourney(world) {
  const ids = ["river-roots", "river-rapids", "river-willows", "overworld"];
  if (ids.some(id => !world.scenes[id])) return;
  const layout = layoutScenes(world.scenes, "overworld");
  const start = layout.offsets.get(ids[0]).y + 34, end = 116, lane = 6;
  const section = y => {
    const id = ids.find(id => {
      const top = layout.offsets.get(id).y;
      return y >= top && y < top + world.scenes[id].height;
    });
    const origin = layout.offsets.get(id), banks = riverSection(mainChannel(world.scenes[id]), y - origin.y);
    return origin.x + (banks.left + banks.right) / 2;
  };
  const points = [];
  for (let y = start; y < end; y += 4) points.push([section(y) - lane, y]);
  for (let i = 0; i <= 12; i++) {
    const angle = Math.PI - i * Math.PI / 12;
    points.push([section(end) + lane * Math.cos(angle), end + 9 * Math.sin(angle)]);
  }
  for (let y = end - 4; y > start; y -= 4) points.push([section(y) + lane, y]);
  for (let i = 0; i <= 12; i++) {
    const angle = i * Math.PI / 12;
    points.push([section(start) + lane * Math.cos(angle), start - 9 * Math.sin(angle)]);
  }
  // Drop the duplicate closing knot. Closed interpolation supplies it without a zero span.
  points.pop();
  for (const id of ids) world.scenes[id].riverLife = [{
    id: "river-walnut-rower", sprite: "walnut-boat-0",
    frames: ["walnut-boat-0", "walnut-boat-1"], returnFrames: ["walnut-return-0", "walnut-return-1"],
    speed: 2.1, phase: 330, bump: "riverBump",
    journey: { points, origin: layout.offsets.get(id) },
  }];
}
module.exports = { prepareRiverJourney };
