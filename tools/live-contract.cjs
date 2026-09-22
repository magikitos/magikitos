"use strict";
const { TILE } = require("../public/assets/js/adventure/geometry");
const { RUN_SPEED } = require("../public/assets/js/adventure/locomotion");
const { FAST_ROW_SPEED, currentAt } = require("../public/assets/js/adventure/river-navigation");
const { docks } = require("../public/assets/js/adventure/docks");
const { crossingAreas } = require("../public/assets/js/adventure/crossings");
const { sharedObjectContract } = require("./shared-object-contract.cjs");
const pixels = (values) => values.map(v => v * TILE);

function transitions(world, scene) {
  const doors = Object.fromEntries(scene.entities.filter(e => e.portal).map(e => {
    const travel = e.rules.flatMap(r => r.effects).filter(f => f.type === "travel");
    if (travel.length !== 1) throw Error(`Ambiguous live doorway: ${scene.id}/${e.id}`);
    const to = travel[0], destination = world.scenes[to.scene];
    return [e.id, { area: pixels(e.threshold), direction: e.entryDirection || 0,
      scene: to.scene, position: pixels([to.x, to.y]), arrival: pixels(e.arrival),
      enters: !scene.indoor && Boolean(destination.indoor),
      returns: Boolean(scene.indoor && e.entryDirection === 1 && !destination.indoor) }];
  }));
  const edges = Object.fromEntries((scene.navigation?.exits || []).map(e => {
    const axis = ["up", "down"].includes(e.direction) ? 0 : 1;
    return [e.id, { scene: e.scene, direction: e.direction, position: pixels(e.position),
      axis, center: (e.area[axis] + e.area[axis + 2] / 2) * TILE,
      half: e.area[axis + 2] * TILE / 2,
      areas: Object.fromEntries(["foot", "boat"].map(mode => [mode, crossingAreas(scene, e, mode).map(pixels)])) }];
  }));
  return { doors, edges, docks: Object.fromEntries(docks(scene).map(d => [d.id,
    { dry: d.dry, arrival: d.arrival, wet: d.wet, outward: d.outward, width: d.width, boarding: d.boarding }])) };
}

/** Movement ceilings use the same physics data as the client, not copied server constants.
 * Only the server artifact receives this metadata; it is not another browser map download. */
function liveContract(world) {
  return {
    start: world.start,
    defaultAvatar: world.playerArt.defaultVariant,
    /**
     * ⛔ EL ELENCO QUE SE PUEDE SER VIAJA AL SERVIDOR, Y CON SU SEXO DENTRO.
     *
     * La cuenta guarda un número, y un número no se puede validar contra nada: el día que una
     * hoja se retire, el duende elegido dejaría de existir y la presencia pediría un sprite que
     * la release ya no dibuja. Aquí va la lista que la release OFRECE de verdad, así que la web
     * valida contra el artefacto instalado y no contra su memoria.
     *
     * Y va el sexo porque es el único dato que la web necesita del arte: al elegir duende se
     * rellena `users.gender` SI está vacío (nunca se pisa lo que la persona dijo de sí misma), y
     * ese dato vive en el elenco (`residents.json`), no en la base de la web.
     */
    avatars: Object.fromEntries(
      world.playerArt.enabledVariants.map((id) => {
        const profile = world.avatarProfiles.find((p) => p.id === id);
        if (!profile) throw Error("Playable duende outside the cast: " + id);
        if (!["M", "F"].includes(profile.gender))
          throw Error("Playable duende without M/F: " + id);
        return [id, profile.gender];
      }),
    ),
    scenes: Object.fromEntries(Object.entries(world.scenes).map(([id, scene]) => {
      let flow = 0;
      if (scene.navigation?.currents?.length)
        for (let y = 0; y < scene.height; y += 0.5)
          for (let x = 0; x < scene.width; x += 0.5) {
            const v = currentAt(scene, x * TILE, y * TILE);
            flow = Math.max(flow, Math.hypot(v.x, v.y));
          }
      const zone = Object.values(world.construction?.zones || {}).find(z => z.scene === id);
      const objects = sharedObjectContract(scene, zone);
      return [id, { width: scene.width * TILE, height: scene.height * TILE,
        spawn: { x: scene.spawn.x * TILE, y: scene.spawn.y * TILE },
        maxFootSpeed: RUN_SPEED, maxBoatSpeed: FAST_ROW_SPEED + Math.ceil(flow),
        transitions: transitions(world, scene), ...(objects ? { objects } : {}) }];
    })),
  };
}
module.exports = { liveContract };
