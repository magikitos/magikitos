"use strict";
/** Reviewed data, not backend code. The website validates writes against its installed artifact. */
function gameContract(world) {
  return {
    protocol: "river-homesteads",
    homesteads: world.homesteads,
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
    },
  };
}
module.exports = { gameContract };
