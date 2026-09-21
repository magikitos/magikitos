"use strict";
const fs = require("node:fs"),
  path = require("node:path"),
  crypto = require("node:crypto");
const {
  validateChanges,
  diff,
  placement,
  FIELDS,
  removable,
} = require("./scene-edits");
const { validateSprites, spriteDiff, cropFor } = require("./sprite-edits");
const { validateElements, elementDiff, bodyOf } = require("./element-edits");
const same = (a, b) => JSON.stringify(a) === JSON.stringify(b);
/** Three-way rebase: already-applied edits disappear; conflicting edits are never discarded. */
function rebase(workspace, before, current) {
  const changes = {},
    sprites = {},
    conflicts = [];
  for (const [scene, groups] of Object.entries(workspace.changes))
    for (const layer of ["entities", "scenery"])
      for (const [id, after] of Object.entries(groups[layer] || {})) {
        const source = (s) =>
          layer === "entities"
            ? s.world.scenes[scene]?.entities
            : s.scenery[scene];
        const old = source(before)?.find((e) => e.id === id),
          now = source(current)?.find((e) => e.id === id);
        if (!old || !now) {
          conflicts.push(scene + "/" + id + ": elemento eliminado");
          continue;
        }
        // Una colocación guardada es COMPLETA: un campo que no trae (una `entrance` borrada) es
        // un campo que se quitó, no uno que se conserva (20-sep-2026, revisión).
        const base = placement(old),
          next = placement(now),
          target = after;
        for (const field of FIELDS)
          if (!same(target[field], base[field])) {
            if (same(next[field], base[field])) next[field] = target[field];
            else if (!same(next[field], target[field]))
              conflicts.push(scene + "/" + id + "/" + field);
          }
        (changes[scene] ||= { entities: {}, scenery: {} })[layer][id] = next;
      }
  for (const [scene, groups] of Object.entries(workspace.changes)) {
    for (const [id, added] of Object.entries(groups.added || {})) {
      const now = current.world.scenes[scene]?.entities.find(
        (e) => e.id === id,
      );
      if (!current.world.scenes[scene]) {
        conflicts.push(scene + "/" + id + ": escena eliminada");
        continue;
      }
      if (!now)
        (changes[scene] ||= { entities: {}, scenery: {} }).added = {
          ...(changes[scene]?.added || {}),
          [id]: added,
        };
      else if (
        now.family !== added.family ||
        !same(placement(now), placement(added))
      )
        conflicts.push(scene + "/" + id + ": alta en conflicto");
    }
    for (const row of groups.removed || []) {
      const source = (s) =>
        row.layer === "entities"
          ? s.world.scenes[scene]?.entities
          : s.scenery[scene];
      const old = source(before)?.find((e) => e.id === row.id),
        now = source(current)?.find((e) => e.id === row.id);
      if (!now) continue;
      if (
        !old ||
        !same(placement(old), placement(now)) ||
        !removable(current, scene, row.layer, row.id)
      )
        conflicts.push(scene + "/" + row.id + ": retirada en conflicto");
      else
        ((changes[scene] ||= { entities: {}, scenery: {} }).removed ||=
          []).push(row);
    }
  }
  // A topology edit is atomic per scene. Concurrent path edits require review, never index guessing.
  for (const [scene, groups] of Object.entries(workspace.changes)) {
    if (!Object.hasOwn(groups, "paths")) continue;
    const old = before.world.scenes[scene]?.paths,
      now = current.world.scenes[scene]?.paths;
    if (!old || !now) conflicts.push(scene + "/paths: escena eliminada");
    else if (same(now, groups.paths)) continue;
    else if (same(old, now))
      (changes[scene] ||= { entities: {}, scenery: {} }).paths = groups.paths;
    else conflicts.push(scene + "/paths");
  }
  for (const [name, after] of Object.entries(workspace.sprites || {})) {
    const old = before.sprites?.[name],
      now = current.sprites?.[name];
    if (!old || !now) {
      conflicts.push("sprite/" + name + ": arte eliminado");
      continue;
    }
    if (same(cropFor(now), after.crop)) continue;
    const oldArt = { ...old.definition },
      newArt = { ...now.definition };
    delete oldArt.crop;
    delete newArt.crop;
    if (!same(oldArt, newArt) || !same(cropFor(old), cropFor(now)))
      conflicts.push("sprite/" + name);
    else sprites[name] = after;
  }
  if (conflicts.length) return { workspace, conflicts };
  return {
    workspace: {
      ...workspace,
      baseHash: current.baseHash,
      changes: validateChanges(current, changes),
      sprites: validateSprites(current, sprites),
      // El cuerpo de un elemento se valida contra el catálogo VIVO: una propuesta ya aplicada al
      // juego vale lo mismo que la fuente y desaparece sola, sin conflicto que resolver.
      elements: validateElements(workspace.elements || {}),
    },
    conflicts: [],
  };
}
class WorkspaceStore {
  constructor(directory) {
    this.directory = directory;
    this.file = path.join(directory, "workspace.json");
    this.snapshots = path.join(directory, "snapshots");
    this.history = path.join(directory, "history");
    for (const p of [this.snapshots, this.history])
      fs.mkdirSync(p, { recursive: true });
  }
  archive(snapshot) {
    const p = path.join(this.snapshots, snapshot.baseHash + ".json");
    if (!fs.existsSync(p))
      fs.writeFileSync(p, JSON.stringify(snapshot), {
        flag: "wx",
        mode: 0o600,
      });
  }
  base(key) {
    if (!/^[a-f0-9]{64}$/.test(key)) throw Error("Base inválida");
    return JSON.parse(
      fs.readFileSync(path.join(this.snapshots, key + ".json"), "utf8"),
    );
  }
  read() {
    return fs.existsSync(this.file)
      ? JSON.parse(fs.readFileSync(this.file, "utf8"))
      : null;
  }
  write(value, previous) {
    const temp =
      this.file + "." + crypto.randomBytes(6).toString("hex") + ".tmp";
    try {
      fs.writeFileSync(temp, JSON.stringify(value, null, 2) + "\n", {
        flag: "wx",
        mode: 0o600,
      });
      if (previous)
        fs.writeFileSync(
          path.join(
            this.history,
            previous.revision + "-" + Date.now() + ".json",
          ),
          JSON.stringify(previous, null, 2) + "\n",
          { flag: "wx", mode: 0o600 },
        );
      fs.renameSync(temp, this.file);
    } finally {
      if (fs.existsSync(temp)) fs.unlinkSync(temp);
    }
  }
  load(current) {
    this.archive(current);
    let value = this.read(),
      conflicts = [];
    if (!value) {
      value = {
        baseHash: current.baseHash,
        revision: 1,
        updatedAt: new Date().toISOString(),
        changes: {},
        sprites: {},
        elements: {},
      };
      this.write(value);
    } else if (value.baseHash !== current.baseHash) {
      const result = rebase(value, this.base(value.baseHash), current);
      conflicts = result.conflicts;
      if (!conflicts.length) {
        const next = {
          ...result.workspace,
          revision: value.revision + 1,
          updatedAt: new Date().toISOString(),
        };
        this.write(next, value);
        value = next;
      }
    }
    return { workspace: value, snapshot: this.base(value.baseHash), conflicts };
  }
  save(input) {
    const previous = this.read();
    if (
      !previous ||
      previous.revision !== input.revision ||
      previous.baseHash !== input.baseHash
    ) {
      const error = Error(
        "El estudio ha cambiado en otra pestaña o tras una revisión. Recarga antes de seguir.",
      );
      error.status = 409;
      throw error;
    }
    const source = this.base(input.baseHash);
    const next = {
      baseHash: source.baseHash,
      revision: previous.revision + 1,
      updatedAt: new Date().toISOString(),
      changes: validateChanges(source, input.changes),
      sprites: validateSprites(source, input.sprites),
      elements: validateElements(input.elements),
    };
    this.write(next, previous);
    return next;
  }
  diff() {
    const value = this.read();
    if (!value) throw Error("Abre el estudio una vez");
    const source = this.base(value.baseHash);
    return {
      purpose: "review-only",
      baseHash: source.baseHash,
      revision: value.revision,
      scenes: diff(source, value.changes),
      sprites: spriteDiff(source, value.sprites),
      elements: elementDiff(value.elements || {}),
    };
  }
}
module.exports = { WorkspaceStore, rebase };
