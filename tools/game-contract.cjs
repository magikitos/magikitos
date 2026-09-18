"use strict";
/** Reviewed data, not backend code. The website validates writes against its installed artifact. */
function gameContract(world) {
  // El horneado escribe en el mundo lo que los dos lados necesitan (la pantalla entera, lo
  // prohibido, los anclajes de paso) y devuelve LAS FILAS DE SUELO, que solo necesita esta
  // autoridad: el navegador las saca de la pantalla que ya tiene cargada. Ver community-terrain.
  const terrain =
    require("./community-terrain.cjs").compileCommunityTerrain(world);
  const construction = {
    ...world.construction,
    zones: Object.fromEntries(
      Object.entries(world.construction.zones).map(([id, zone]) => [
        id,
        { ...zone, terrain: terrain[id] },
      ]),
    ),
  };
  return {
    protocol: "river-commons",
    live: require("./live-contract.cjs").liveContract(world),
    construction,
    adventure: {
      flags: world.flags,
      items: world.items,
      timers: world.timers,
      economy: world.economy,
      needs: world.needs,
      messages: world.messages,
      entities: {
        player: {
          needs: {
            rules: [
              {
                action: "poop",
                when: { items: { leaf: 1 } },
                effects: [{ type: "item", item: "leaf", amount: -1 }],
              },
            ],
          },
        },
        ...Object.fromEntries(
          Object.entries(world.scenes).map(([scene, data]) => [
            scene,
            Object.fromEntries(
              // Retired ground nodes are terminal no-op commands, not hidden
              // entities. Older/offline clients receive no_material_action and
              // drain their durable outbox without minting deleted resources.
              (world.resourceRegions[scene]?.nodes || [])
                .filter((id) => !data.entities.some((e) => e.id === id))
                .map((id) => [id, { rules: [{ effects: [] }] }])
                .concat(
                  data.entities
                    .filter((e) =>
                      e.rules?.some((r) =>
                        r.effects.some((f) =>
                          ["item", "flag", "collect", "reward", "timer", "spend"].includes(f.type),
                        ),
                      ),
                    )
                    .map((e) => [
                      e.id,
                      {
                        rules: e.rules,
                        hiddenWhen: e.hiddenWhen,
                        visibleWhen: e.visibleWhen,
                        resource: e.resource,
                        requires: data.requires,
                      },
                    ]),
                ),
            ),
          ]),
        ),
      },
    },
    progress: {
      flags: world.flags,
      items: Object.fromEntries(
        Object.entries(world.items).map(([id, item]) => [id, item.max || 99]),
      ),
      timers: Object.keys(world.timers),
      rewards: Object.keys(world.economy.rewards),
      maxBalance: world.economy.maxBalance,
      scenes: Object.fromEntries(
        Object.entries(world.scenes).map(([id, scene]) => [
          id,
          { width: scene.width * 16, height: scene.height * 16 },
        ]),
      ),
      resourceRegions: world.resourceRegions,
    },
  };
}
module.exports = { gameContract };
