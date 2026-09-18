"use strict";
const { docks } = require("../public/assets/js/adventure/docks");
const { TILE } = require("../public/assets/js/adventure/geometry");

/**
 * ⛔ LA BARCA AMARRADA SE PONE EN EL MUELLE, NO EN EL SITIO DONDE SE SUBE UNO.
 *
 * Son dos cosas distintas y estaban en el mismo punto. El ancla `water` de un amarre es FÍSICA:
 * es donde flota la barca contigo dentro, y no puede acercarse más a los tablones porque el casco
 * tiene radio y las cuatro sondas de `canFloat` tocarían el muelle. Medido: entre 3,1 y 4,6 tiles
 * de la punta, o sea de cincuenta a setenta y cuatro píxeles de agua abierta entre la madera y la
 * barca aparcada. Desde fuera eso no se lee como «amarrada»: se lee como una barca a la deriva.
 *
 * La barca aparcada, en cambio, es UN DIBUJO: no navega, no colisiona y no la valida nadie. Así
 * que se pone donde tiene sentido verla —pegada a la punta de los tablones— sin tocar el ancla
 * con la que se sube, que es lo que el demonio compila y lo que juzga el atraque.
 *
 * Y se DERIVA del muelle de verdad (`docks()`, la misma función que usa el juego para saber dónde
 * acaban las tablas), no de un número escrito a mano: el día que el dueño mueva un embarcadero en
 * el Studio, la barca se mueve con él. Un punto de amarre escrito a mano sería una coordenada más
 * que caduca en silencio, que es justo lo que este repositorio lleva una semana quitándose.
 */
/** Lo que la barca asoma más allá del último tablón. Poco más de un tile: lo justo para que se
 *  vea amarrada y no encima de la madera. */
const GAP = 1.2;

function moorVessels(world) {
  let moored = 0;
  for (const scene of Object.values(world.scenes)) {
    if (!scene.navigation?.landings?.length) continue;
    for (const dock of docks(scene)) {
      const vessel = scene.entities.find((e) => e.id === "moored-" + dock.id);
      if (!vessel) throw Error("Landing without its moored vessel: " + scene.id + "/" + dock.id);
      // `dry` es la punta menos diez píxeles; se recupera la punta y se sale de ahí.
      vessel.x = (dock.dry.x + dock.outward.x * (10 + GAP * TILE)) / TILE;
      vessel.y = (dock.dry.y + dock.outward.y * (10 + GAP * TILE)) / TILE;
      moored++;
    }
  }
  return moored;
}
module.exports = { moorVessels, MOOR_GAP: GAP };
