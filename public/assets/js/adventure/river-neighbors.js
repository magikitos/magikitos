"use strict";

/** Public addresses are sampled once per voyage/session, never polled as live presence. */
class RiverNeighbors {
  constructor(home) {
    this.home = home;
    this.items = null;
    this.pending = null;
  }
  async prepare(data) {
    if (
      !data?.entities.some((e) => Number.isInteger(e.parcelSlot)) ||
      this.items
    )
      return;
    this.pending ||= this.home.game.api
      .request("parcels", {}, { timeout: 2000 })
      .then((result) => {
        if (!Array.isArray(result.items) || result.items.length > 8)
          throw Error("invalid_parcels");
        this.items = result.items.filter(
          (item) =>
            /^[a-f0-9]{32}$/.test(item.id) &&
            item.id !== this.home.game.cloud.meta.id,
        );
      })
      .catch(() => {
        this.items = [];
      })
      .finally(() => {
        this.pending = null;
      });
    await this.pending;
  }
  sceneData(data) {
    if (!data.entities.some((e) => Number.isInteger(e.parcelSlot))) return data;
    return {
      ...data,
      entities: data.entities.map((entity) => {
        if (!Number.isInteger(entity.parcelSlot)) return entity;
        const item = this.items?.[entity.parcelSlot];
        return {
          ...entity,
          onInteract: () => {
            const g = this.home.game;
            if (!item) {
              g.openDialogue(g.lines("homeNoNeighbors"));
              return;
            }
            const landing = data.navigation.landings.find(
              (l) => l.id === entity.parcelLanding,
            );
            const owner = String(
              item.owner?.name || item.owner?.handle || "Magikito",
            ).slice(0, 120);
            g.toast(owner);
            this.home.visit(item.id, {
              id: "visited-jetty",
              scene: data.id,
              position: landing.water,
              direction: "left",
            });
          },
        };
      }),
    };
  }
}
module.exports = { RiverNeighbors };
