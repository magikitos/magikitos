"use strict";
/** Reviewed data, not backend code. The website validates writes against its installed artifact. */
function gameContract(world) {
  require("./community-terrain.cjs").compileCommunityTerrain(world);
  return {
    protocol: "river-homesteads",
    homesteads: world.homesteads,
    construction: world.construction,
    adventure: {
      flags: world.flags,
      items: world.items,
      timers: world.timers,
      economy: world.economy,
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
              data.entities
                .filter((e) =>
                  e.rules?.some((r) =>
                    r.effects.some((f) =>
                      [
                        "item",
                        "flag",
                        "collect",
                        "reward",
                        "timer",
                        "spend",
                      ].includes(f.type),
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
