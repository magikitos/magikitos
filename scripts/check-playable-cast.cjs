"use strict";
const assert = require("node:assert/strict");
const fs = require("node:fs"),
  path = require("node:path");
const {
  castOffered,
  castVariant,
  castPortrait,
  playerVariant,
  CAST_PORTRAITS,
} = require("../public/assets/js/adventure/player-art");
const { readCast, writeCast, CAST_KEY } = require("../public/assets/js/adventure/save");
const { gameContract } = require("../tools/game-contract.cjs");

const { isolateWorld, compileWorld: compile } = require("./lib/world-fixture.cjs");
const world = compile(process.cwd());
const manifest = require("../public/assets/aventura/manifest.json");
const actions = Object.keys(require("../data/aventura/art/residents/actions/catalog.json").actions);
const authored = Object.keys(require("../data/aventura/player-art.json").rowingRigs).map(Number);
const offered = castOffered(world);

/**
 * ⛔ EL ELENCO SE MIDE, NO SE DECLARA.
 *
 * Que un duende esté ofrecido significa exactamente dos cosas comprobables: que alguien le midió
 * el remo a mano (`rowingRigs`, lo único de autoría) y que sus siete acciones están HORNEADAS. La
 * lista no se escribe en ninguna parte, así que no puede caducar; lo que sí puede pasar —y es lo
 * que se prueba abajo en negativo— es que alguien retire una hoja y el elenco no se entere.
 */
assert.deepEqual([...offered].sort((a, b) => a - b), offered, "The offered cast is ordered");
assert.equal(new Set(offered).size, offered.length, "No duende is offered twice");
assert(offered.includes(world.playerArt.defaultVariant), "The starting duende must be offered");
for (const id of offered) {
  assert(authored.includes(id), "An offered duende has a measured oar rig: " + id);
  for (const action of actions)
    assert(manifest.packs[`actor-${id}-${action}`], `Offered duende ${id} is missing ${action}`);
}
for (const id of authored)
  if (!offered.includes(id))
    assert(
      actions.some((action) => !manifest.packs[`actor-${id}-${action}`]),
      "A duende is only left out for missing art: " + id,
    );

// El retrato del selector existe para CADA duende ofrecido, y sale del mismo paquete pequeño.
const portraits = manifest.packs[CAST_PORTRAITS];
assert(portraits, "The cast portraits package must be baked");
for (const id of offered)
  assert(
    portraits.sprites.includes(castPortrait(id)),
    "Stale cast portraits: re-run prepare-cast-portraits for " + id,
  );
assert.deepEqual(
  [...portraits.sprites].sort(),
  authored.map(castPortrait).sort(),
  "Portraits cover the authored cast exactly: no duende without a face, no face without a duende",
);
// Un retrato es UNA pose, no una hoja de andar: si alguien la cambia por el paquete completo, el
// selector pasaría de unos kilobytes a decenas de megas sin que nada fallara.
assert(
  portraits.width * portraits.height * 4 < 4 * 1024 * 1024,
  "The portrait sheet stays small enough to lend while a panel is open",
);

/** El contrato del servidor lleva el mismo elenco y su sexo, que es lo único que la web necesita
 * del arte para rellenar `users.gender` cuando está vacío. */
const live = gameContract(world).live;
assert.deepEqual(
  Object.keys(live.avatars).map(Number).sort((a, b) => a - b),
  offered,
  "The installed artifact offers exactly what the world derived",
);
assert.equal(live.defaultAvatar, world.playerArt.defaultVariant);
const residents = Object.fromEntries(world.avatarProfiles.map((p) => [p.id, p.gender]));
for (const [id, gender] of Object.entries(live.avatars)) {
  assert(["M", "F"].includes(gender), "Every offered duende declares M/F: " + id);
  assert.equal(gender, residents[id], "The contract copies the cast, it does not invent: " + id);
}

/** Un número que esta release no dibuja nunca deja a nadie sin cuerpo. */
assert.equal(castVariant(world, offered.at(-1)), offered.at(-1));
for (const rubbish of [null, undefined, 7, -1, 1.5, "100", NaN])
  assert.equal(castVariant(world, rubbish), world.playerArt.defaultVariant, String(rubbish));
assert.equal(playerVariant({ variant: null }), world.playerArt.defaultVariant, "Nobody chose yet");
assert.equal(playerVariant({ variant: offered.at(-1) }), offered.at(-1));

/** El navegador guarda la elección FUERA de la partida, así que restaurar un viaje viejo no te
 * cambia la cara y subirlo no pide que el contrato valide progreso que no es progreso. */
const store = new Map();
const storage = {
  getItem: (k) => (store.has(k) ? store.get(k) : null),
  setItem: (k, v) => store.set(k, String(v)),
};
assert.equal(readCast(world, storage), null, "Nothing stored means nobody has said");
writeCast(offered.at(-1), storage);
assert.equal(readCast(world, storage), offered.at(-1));
storage.setItem(CAST_KEY, "999999");
assert.equal(readCast(world, storage), null, "A duende this release does not draw is forgotten");
storage.setItem(CAST_KEY, "nope");
assert.equal(readCast(world, storage), null);
const { cleanSave } = require("../public/assets/js/adventure/save");
assert(
  !Object.hasOwn(cleanSave(null, world), "avatar"),
  "The journey never carries the body: restoring an older save cannot change your face",
);

/** Las hojas que el cuerpo necesita en una pantalla existen para CUALQUIER duende ofrecido, así
 * que elegir no puede pedirle al almacén un paquete que no está horneado. */
const { playerPacks } = require("../public/assets/js/adventure/scenes");
const { World } = require("../public/assets/js/adventure/model");
for (const scene of Object.values(world.scenes)) {
  const model = new World(scene);
  model.refresh({ flags: {}, inventory: {} });
  for (const id of offered)
    for (const mode of ["foot", "boat"])
      for (const pack of playerPacks(
        { player: { variant: id } },
        model,
        { navigation: { mode } },
        { variant: id },
      ))
        assert(manifest.packs[pack], `${scene.id} asks ${id} for an unbaked ${pack}`);
}

/**
 * ⛔ LO QUE LOS DEMÁS VEN DE TI TIENE QUE ESTAR DIBUJADO, POSE A POSE Y DUENDE A DUENDE.
 *
 * El bosque manda una fila por persona con su duende, su dirección y su pose, y el cliente compone
 * el nombre del sprite. Un solo hueco en esa tabla —una pose que un protagonista no tenga— no da
 * un error: pide un paquete que no existe DENTRO del bucle de pintado, o sea que un desconocido
 * haciendo algo raro tumba el bosque de quien lo esté mirando. Se recorre el producto entero, con
 * un reloj falso para barrer las cuatro fases de cada animación.
 */
{
  const { ForestPeople } = require("../public/assets/js/adventure/forest-people");
  const { protocol } = require("../public/assets/js/adventure/forest-connection");
  let clock = 0;
  const peers = new ForestPeople((v) => v, () => clock);
  const bounds = { width: 1000, height: 1000 };
  const owners = new Map();
  for (const [id, pack] of Object.entries(manifest.packs))
    for (const sprite of pack.sprites) owners.set(sprite, id);
  const { ActorArt } = require("../public/assets/js/adventure/actor-art");
  // El motor cae al plano de reposo cuando un nombre no está: lo que NO puede pasar es que ni el
  // nombre ni su respaldo existan, porque entonces se le pide al almacén un sprite sin dueño y eso
  // revienta DENTRO del bucle de pintado. Se pregunta con la misma función que usa el renderer.
  const art = new ActorArt({ frame: (name) => (owners.has(name) ? {} : null) });
  const seen = new Set();
  let rows = 0;
  for (const variant of offered)
    for (let direction = 0; direction < protocol.directions.length; direction++)
      for (let pose = 0; pose < protocol.poses.length; pose++)
        for (const mode of [0, 1]) {
          clock = 0;
          const id = "b".repeat(24);
          peers.clear();
          assert(
            peers.snapshot(
              { scene: "overworld", people: [[id, 100, 100, direction, pose, variant, mode]] },
              "overworld",
              bounds,
            ),
            "The forest row is well formed",
          );
          // Diez pasos de un décimo de segundo barren las cuatro fases de andar y las del remo.
          for (let step = 0; step <= 10; step++) {
            clock = step * 100;
            for (const peer of peers.update(step % 2 === 0)) {
              seen.add(peer.sprite);
              if (peer.vesselArt) seen.add(peer.vesselArt.hull);
              rows++;
            }
          }
        }
  for (const sprite of seen)
    assert(owners.has(art.frame(sprite)), "A stranger asks for art nobody baked: " + sprite);
  assert(rows > 0 && seen.size > 0, "The sweep really rendered somebody");
  // Y la cobertura de verdad: las cuatro acciones con dirección propia existen ENTERAS para cada
  // duende ofrecido. Sin esto, el respaldo de arriba taparía una hoja que falta entera.
  for (const id of offered) {
    for (const heading of protocol.directions)
      for (const action of ["run", "carried"])
        assert(owners.has(`person-${id}-${heading}-${action}-0`), `${id} ${heading} ${action}`);
    for (const heading of ["down", "right", "up", "left"])
      for (const action of ["push", "work"])
        assert(owners.has(`person-${id}-${heading}-${action}-0`), `${id} ${heading} ${action}`);
    for (const solo of ["pee-0", "poop-0", "discover-0"])
      assert(owners.has(`person-${id}-${solo}`), `${id} ${solo}`);
  }
  console.log(
    `  · ${seen.size} distinct appearances across ${offered.length} duendes × ` +
      `${protocol.directions.length} headings × ${protocol.poses.length} poses, all baked.`,
  );
}

/**
 * ⛔ EN NEGATIVO: SI SE RETIRA UNA HOJA, EL DUENDE SALE DEL ELENCO SOLO.
 *
 * Es lo único que demuestra que la lista se DERIVA. Se compila el mundo contra un manifiesto al
 * que le falta una acción de un duende ofrecido, sin tocar una línea de datos de autoría.
 */
const victim = offered.at(-1);
const temp = isolateWorld("magikitos-cast-");
try {
  const short = JSON.parse(JSON.stringify(manifest));
  delete short.packs[`actor-${victim}-row`];
  const manifestFile = path.join(temp, "public/assets/aventura/manifest.json");
  fs.writeFileSync(manifestFile, JSON.stringify(short));
  assert.deepEqual(
    compile(temp).playerArt.enabledVariants,
    offered.filter((id) => id !== victim),
    "A withdrawn sheet takes its duende out of the cast without anyone editing a list",
  );
  // Y si lo que se retira es el duende de la casa, el mundo no compila: mejor no publicar que
  // publicar un bosque en el que quien llega nuevo no tiene cuerpo.
  const orphan = JSON.parse(JSON.stringify(manifest));
  delete orphan.packs[`actor-${world.playerArt.defaultVariant}-row`];
  fs.writeFileSync(manifestFile, JSON.stringify(orphan));
  assert.throws(() => compile(temp), /not fully drawn/);
} finally {
  fs.rmSync(temp, { recursive: true });
}

/**
 * ⛔ CAMBIARSE DE CARA PIDE UNA RENOVACIÓN DEL TICKET, Y NO SUELTA LA CONEXIÓN.
 *
 * Es lo que hace que el resto del bosque te vea con el duende nuevo sin que pierdas tu sitio en
 * las cien plazas: el ticket lleva el duende dentro y el bosque lo aplica al RENOVARLO. Soltar y
 * volver a entrar te devolvería al final de la cola por haberte cambiado de ropa, así que aquí se
 * comprueba que nadie toca la conexión y que la renovación solo se pide cuando la cuenta aceptó el
 * cambio de verdad — pedirla tras un fallo firmaría el duende viejo.
 */
async function renewalOnChange() {
  const { Adventure } = require("../public/assets/js/adventure/game");
  const target = offered.find((v) => v !== world.playerArt.defaultVariant) ?? offered[0];
  for (const accepted of [true, false]) {
    const calls = [];
    const game = {
      catalog: world,
      avatar: null,
      player: { variant: null },
      ready: false,
      paintCards: () => calls.push("paint"),
      materials: { chooseAvatar: async (v) => { calls.push("account:" + v); return accepted; } },
      live: { connection: {
        renew: async () => { calls.push("renew"); return true; },
        start: () => calls.push("start"),
        stop: () => calls.push("stop"),
      } },
    };
    const promise = Adventure.prototype.wear.call(game, target);
    // El cuerpo cambia ANTES de esperar a nadie: la partida local no depende de la red.
    assert.equal(game.avatar, target, "The body changes before anything is awaited");
    assert.equal(game.player.variant, target);
    assert.equal(await promise, target);
    assert.deepEqual(
      calls.filter((c) => c === "renew"),
      accepted ? ["renew"] : [],
      "The ticket is renewed only when the account took the change: " + JSON.stringify(calls),
    );
    assert(!calls.includes("stop") && !calls.includes("start"), "Changing clothes never costs the seat");
    assert(calls.includes("account:" + target), "The account is told");
    // Elegir el mismo duende no vuelve a molestar ni a la cuenta ni al bosque.
    const again = calls.length;
    assert.equal(await Adventure.prototype.wear.call(game, target), target);
    assert.equal(calls.length, again, "Choosing what you already are does nothing");
  }
}
renewalOnChange().then(() => {
  console.log(
    `PASS playable cast: ${offered.length} derived duendes with their seven sheets, oar rig, ` +
      `portrait and M/F; withdrawal proven in negative; changing clothes renews the ticket ` +
      `instead of dropping the seat; the journey never carries the body.`,
  );
});
