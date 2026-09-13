"use strict";
const { TILE } = require("./model");
/** Physical content areas. No link, player button or NPC can open another area's content. */
class ContentRooms {
  constructor(game) {
    this.game = game;
  }
  contains(key) {
    const room = this.game.catalog.contentRooms[key],
      { player, state } = this.game;
    if (!room || room.scene !== state.scene) return false;
    if (room.circle)
      return (
        Math.hypot(
          player.x / TILE - room.circle[0],
          player.y / TILE - room.circle[1],
        ) <= room.circle[2]
      );
    if (room.rect) {
      const [x, y, w, h] = room.rect;
      return (
        player.x / TILE >= x &&
        player.y / TILE >= y &&
        player.x / TILE < x + w &&
        player.y / TILE < y + h
      );
    }
    return true;
  }
  focus(key) {
    const room = this.game.catalog.contentRooms[key];
    const entity = this.game.world.entities.find((e) => e.id === room?.focus);
    return entity || this.game.player;
  }
  forKind(kind) {
    return Object.keys(this.game.catalog.contentRooms).find((key) =>
      this.game.catalog.contentRooms[key].kinds?.includes(kind),
    );
  }
  enforce() {
    const game = this.game;
    if (game.site.current && !this.contains(game.site.current.group)) {
      game.site.current = null;
      game.closeContent();
    }
    if (game.media.item && !this.contains(this.forKind(game.media.item.kind)))
      game.media.stop();
  }
}
module.exports = { ContentRooms };
