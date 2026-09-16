"use strict";
const { World, TILE } = require("./model");
const { createNeighbors } = require("./neighbors");
const { furnishWorkshop } = require("./workshop");
const { ApiError } = require("./api");
/** Content is optional enrichment. The world boots and remains playable when the API is offline. */
class WorldContent {
  constructor(game) {
    this.game = game;
    this.pools = new Map();
    this.jobs = new Map();
    this.catalogues = new Map();
  }
  bootstrap() {
    if (!this.boot)
      this.boot = this.game.api
        .once("bootstrap")
        .then((data) => {
          if (
            data.locale !== this.game.config.locale ||
            !data.destinations ||
            !data.capabilities
          )
            throw new ApiError("invalid_bootstrap");
          const destinations = {};
          for (const [key, value] of Object.entries(data.destinations)) {
            const url = this.game.api.url(value);
            if (url) destinations[key] = url;
          }
          this.game.config.destinations = destinations;
          this.game.config.capabilities = {
            identity: data.capabilities.identity === true,
            ratings: data.capabilities.ratings === true,
            guardian: data.capabilities.guardian === true,
            turnstileSiteKey:
              typeof data.capabilities.turnstileSiteKey === "string"
                ? data.capabilities.turnstileSiteKey
                : "",
          };
          this.game.config.limits = data.limits || {};
          return data;
        })
        .catch((error) => {
          this.boot = null;
          throw error;
        });
    return this.boot;
  }
  async batch(kind, round = 1, exclude = []) {
    const data = await this.game.api.once("discover", {
      kind,
      round,
      exclude: exclude.slice(-400).join(","),
    });
    return this.game.api.pieces(data);
  }
  async pool(kind) {
    if (this.pools.has(kind)) return this.pools.get(kind);
    const key = "cast:" + kind;
    if (!this.jobs.has(key))
      this.jobs.set(
        key,
        this.batch(kind)
          .then((items) => {
            if (items.length) this.pools.set(kind, items);
            return items;
          })
          .finally(() => this.jobs.delete(key)),
      );
    return this.jobs.get(key);
  }
  /** One bounded request per physical gathering, not one request per visitor. */
  sceneChanged(id) {
    this.bootstrap().catch(() => {});
    const data = this.game.catalog.scenes[id];
    const groups = new Set(
      [...(data.gatherings || []), ...(data.neighbors || [])]
        .map((n) => n.content)
        .filter(Boolean),
    );
    for (const group of groups) {
      const kind = this.game.catalog.contentRooms[group]?.kinds?.find((k) =>
        ["cuento", "chiste", "expresion"].includes(k),
      );
      if (kind)
        this.pool(kind)
          .then((items) => this.assignCast(id, group, items))
          .catch(() => {});
    }
    if (id === "workshop")
      this.products()
        .then((products) => this.furnish(products))
        .catch(() => {});
  }
  async assignCast(scene, group, items) {
    const g = this.game;
    g.config.cast[group] = items;
    if (g.state.scene !== scene) return;
    const candidates = createNeighbors(g.world, g.config, g.cast);
    const packs = await g.renderer.sprites.prepare(
      [],
      [...new Set(candidates.map((n) => "actor-" + n.variant))],
    );
    if (g.state.scene !== scene) return;
    g.renderer.sprites.activate(
      new Set([...g.renderer.sprites.pinned, ...packs]),
    );
    for (const actor of g.neighbors) {
      const replacement = candidates.find((n) => n.id === actor.id);
      if (replacement)
        Object.assign(actor, {
          person: replacement.person,
          piece: replacement.piece,
          variant: replacement.variant,
        });
    }
  }
  async catalogue(kind, signal, cursor = 0) {
    const data = await this.game.api.request(
      "catalog",
      { kind, cursor },
      { signal },
    );
    if (
      !Array.isArray(data.items) ||
      data.items.length > 24 ||
      (data.nextCursor !== null &&
        (!Number.isSafeInteger(data.nextCursor) || data.nextCursor <= cursor))
    )
      throw new ApiError("invalid_catalogue");
    const nextCursor = this.game.api.cursor(data, cursor);
    const items = data.items.map((raw) => {
      if (!Number.isSafeInteger(raw.id) || raw.id < 1)
        throw new ApiError("invalid_catalogue");
      if (kind === "products") {
        if (
          typeof raw.name !== "string" ||
          !Number.isSafeInteger(raw.price) ||
          raw.price < 0 ||
          raw.currency !== "EUR" ||
          !Number.isSafeInteger(raw.quantity)
        )
          throw new ApiError("invalid_product");
        const image = this.game.api.url(raw.image),
          url = this.game.api.url(raw.url);
        if (!url) throw new ApiError("invalid_url");
        return {
          id: raw.id,
          name: raw.name.slice(0, 300),
          price: raw.price,
          currency: "EUR",
          quantity: raw.quantity,
          image,
          url,
        };
      }
      const image = this.game.api.url(raw.image),
        thumb = this.game.api.url(raw.thumb);
      if (kind !== "art" || typeof raw.title !== "string" || !image || !thumb)
        throw new ApiError("invalid_sheet");
      return { id: raw.id, title: raw.title.slice(0, 300), image, thumb };
    });
    return { items, nextCursor };
  }
  products() {
    if (this.catalogues.has("products"))
      return Promise.resolve(this.catalogues.get("products"));
    if (!this.jobs.has("products"))
      this.jobs.set(
        "products",
        (async () => {
          const items = [];
          let cursor = 0;
          do {
            const data = await this.catalogue("products", null, cursor);
            items.push(...data.items);
            cursor = data.nextCursor;
            if (items.length > 2400) throw new ApiError("catalogue_too_large");
          } while (cursor !== null);
          this.catalogues.set("products", items);
          return items;
        })().finally(() => this.jobs.delete("products")),
      );
    return this.jobs.get("products");
  }
  furnish(products) {
    const g = this.game;
    if (g.config.products === products) return;
    const old = g.catalog.scenes.workshop;
    g.config.products = products;
    g.catalog = furnishWorkshop(g.config.world, products);
    g.scenes.cache.delete("workshop");
    if (g.state.scene !== "workshop") return;
    const world = new World(g.catalog.scenes.workshop),
      nearExit = g.player.y > (old.height - 7) * TILE;
    if (nearExit || !world.canStand(g.player.x, g.player.y)) {
      g.player.x = world.data.spawn.x * TILE;
      g.player.y = world.data.spawn.y * TILE;
    }
    g.pauseMovement();
    g.world = world;
    world.actors = [g.player, ...g.neighbors];
    world.refresh(g.state);
    g.renderer.world = world;
    g.renderer.terrain.chunks.clear();
    g.renderer.resize();
    g.centerCamera(true);
    g.portalLatch = new Set();
    g.contactLatch = null;
    g.dirty = true;
    g.save();
  }
}
module.exports = { WorldContent };
