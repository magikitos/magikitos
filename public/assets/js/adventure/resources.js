"use strict";
/** One bit per authored pickup, one cycle per region. IDs live in static data,
 * never duplicated in inventory. A full bag does not consume the ground node. */
function cycle(node, now) {
  return Math.floor(now / node.renewMs);
}
function collected(state, node, now = Date.now()) {
  if (!node) return false;
  const entry = state.resources?.[node.region];
  if (!entry || entry.cycle !== cycle(node, now)) return false;
  return Boolean(
    (parseInt(entry.bits[Math.floor(node.index / 4)] || "0", 16) || 0) &
      (1 << node.index % 4),
  );
}
function collect(state, node, now = Date.now()) {
  if (!node || collected(state, node, now))
    throw new Error("Resource unavailable");
  const current = cycle(node, now),
    previous = state.resources?.[node.region];
  const bits = (previous?.cycle === current ? previous.bits : "")
    .padEnd(Math.floor(node.index / 4) + 1, "0")
    .split("");
  const at = Math.floor(node.index / 4);
  bits[at] = ((parseInt(bits[at], 16) || 0) | (1 << node.index % 4)).toString(
    16,
  );
  state.resources = {
    ...state.resources,
    [node.region]: { cycle: current, bits: bits.join("") },
  };
}
function cleanResources(value, catalog, now = Date.now()) {
  const result = {};
  for (const [region, definition] of Object.entries(
    catalog.resourceRegions || {},
  )) {
    const entry = value?.[region],
      current = Math.floor(now / definition.renewMs);
    if (
      !entry ||
      entry.cycle !== current ||
      typeof entry.bits !== "string" ||
      !/^[a-f0-9]+$/.test(entry.bits) ||
      entry.bits.length > Math.ceil(definition.nodes.length / 4)
    )
      continue;
    result[region] = { cycle: current, bits: entry.bits };
  }
  return result;
}
module.exports = { collected, collect, cleanResources };
