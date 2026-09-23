"use strict";
const { TILE, hash, random } = require("./model");
const { facing } = require("./characters");
const { ZoneCasting } = require("./casting");
/** Build a local cast. One public author appears once; extra seats are fictional visitors. */
function createNeighbors(world, config, ambientCast, choose = Math.random) {
  const slots = (world.data.neighbors || []).map((slot) => ({
    ...slot,
    ...(slot.lookAt
      ? { lookAt: { x: slot.lookAt[0] * TILE, y: slot.lookAt[1] * TILE } }
      : {}),
  }));
  // Ambient population: extra residents who live the scene (`life.json`), born on its paths.
  const population = config.world?.life?.population?.[world.data.id] || 0;
  if (population) {
    const rand = random(hash(world.data.id + ":population")),
      points = (world.data.paths || []).flat().filter(([x, y]) => world.canStand((x + 0.5) * TILE, (y + 0.5) * TILE));
    // Each on its own point, three tiles from the others: two born on the same vertex block each
    // other's body and neither can ever take a step.
    const taken = [];
    for (let i = 0, tries = 0; taken.length < population && points.length && tries < population * 12; tries++) {
      const [x, y] = points[Math.floor(rand() * points.length)];
      if (taken.some(([tx, ty]) => Math.hypot(tx - x, ty - y) < 3)) continue;
      taken.push([x, y]);
      slots.push({ id: world.data.id + "-life-" + i++, x: x + 0.5, y: y + 0.5, radius: 4, population: true });
    }
  }
  for (const gathering of world.data.gatherings || []) {
    const count =
      gathering.min +
      Math.floor(choose() * (gathering.max - gathering.min + 1));
    for (let i = 0; i < count; i++) {
      const angle = (i / count) * Math.PI * 2;
      slots.push({
        id: gathering.id + "-" + i,
        content: gathering.content,
        lookAt: { x: gathering.x * TILE, y: gathering.y * TILE },
        radius: gathering.wander ?? 0.7,
        x: gathering.x + Math.cos(angle) * gathering.radius,
        y: gathering.y + Math.sin(angle) * gathering.radius * 0.72,
      });
    }
  }
  const actionFaces = new Set(config.world?.playerArt?.enabledVariants || []);
  const seen = new Set(),
    cursors = {};
  const casting = new ZoneCasting(
    config.world.avatarProfiles,
    world.data.actors || [],
  );
  return slots.map((slot, index) => {
    const pool = slot.content ? config.cast?.[slot.content] || [] : ambientCast;
    const person = pool.find(
      (person) => person.handle && !seen.has(person.handle),
    );
    if (person) seen.add(person.handle);
    const identity = person?.handle || slot.id;
    // Appearance is a local art decision; website identity never selects an obsolete sprite index.
    // The ambient population prefers faces with action sheets: they tend beds with their own hands.
    const variant =
      slot.variant ?? casting.choose(identity, world.region(slot.x, slot.y), slot.population ? actionFaces : null);
    const cursor = cursors[slot.content] || 0;
    cursors[slot.content] = cursor + 1;
    // Visitors can share a published piece; its actual author remains credited in the folio.
    const piece = slot.content
      ? person || pool[cursor % pool.length] || null
      : null;
    const direction = slot.lookAt
      ? facing(slot.lookAt.x - slot.x * TILE, slot.lookAt.y - slot.y * TILE)
      : "down";
    return {
      ...slot,
      direction,
      x: slot.x * TILE,
      y: slot.y * TILE,
      home: { x: slot.x * TILE, y: slot.y * TILE },
      neighbor: true,
      // Free to live its own day (`life.js`): not holding published content, not placed by the
      // Studio to stand still or to fish at an authored spot.
      lifeFree: !slot.content && !slot.fishing && slot.radius !== 0,
      person: person || null,
      piece,
      variant,
      sprite: "person-" + variant + "-" + direction,
      path: [],
      pause: 1 + index,
      rand: random(hash(identity)),
      moving: false,
    };
  });
}
module.exports = { createNeighbors };
