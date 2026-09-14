"use strict";
const { TILE, hash, random } = require("./model");
const { facing } = require("./characters");
/** Build a local cast. One public author appears once; extra seats are fictional visitors. */
function createNeighbors(world, config, ambientCast, choose = Math.random) {
  const slots = [...(world.data.neighbors || [])];
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
        radius: 0.7,
        x: gathering.x + Math.cos(angle) * gathering.radius,
        y: gathering.y + Math.sin(angle) * gathering.radius * 0.72,
      });
    }
  }
  const seen = new Set(),
    cursors = {};
  return slots.map((slot, index) => {
    const pool = slot.content ? config.cast?.[slot.content] || [] : ambientCast;
    const person = pool.find(
      (person) => person.handle && !seen.has(person.handle),
    );
    if (person) seen.add(person.handle);
    const identity = person?.handle || slot.id;
    // Appearance is a local art decision; website identity never selects an obsolete sprite index.
    const variant = 1 + (hash(identity) % config.world.avatarVariants);
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
