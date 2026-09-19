"use strict";
const { TILE } = require("./geometry");
const { groundMask } = require("./construction-layout");
const { World } = require("./model");

/**
 * ⛔ DÓNDE SE PUEDE ESTAR DE PIE SE PREGUNTA UNA SOLA VEZ, Y AQUÍ.
 *
 * El servidor recibe esta misma máscara horneada en filas compactas y el navegador la calcula de
 * la pantalla que ya tiene cargada: son el mismo muestreo porque son la misma función. Cuando eran
 * dos —una en el compilador y otra donde hiciera falta— lo único que las mantenía iguales era
 * acordarse, y de eso no se acuerda nadie el día que cambia el tamaño de un duende.
 *
 * Las cinco esquinas no son una aproximación barata de «cabe»: son exactamente lo que el juego
 * comprueba para dejarte pisar un tile, así que el suelo construible y el suelo caminable no
 * pueden discrepar.
 *
 * ⛔ Y SE PREGUNTA POR EL DATO CRUDO DE LA PANTALLA, NO POR EL MUNDO QUE SE ESTÁ JUGANDO. El mundo
 * vivo lleva cosidas las piezas que ha puesto la gente (`community.sceneData()`), así que tiene
 * agujeros donde hay un banco ajeno; la máscara que el servidor horneó sale de la pantalla SIN
 * nadie encima. Con el mundo vivo, el fantasma diría «necesita suelo firme» sobre el sitio de un
 * banco que se acaba de quitar y la autoridad diría que sí: dos motores discrepando sin que falle
 * nada en ninguna parte. Por eso quien pregunta pasa el CATÁLOGO y un nombre de pantalla, y no un
 * modelo: así no queda ninguna decisión que se pueda tomar mal.
 */
const STAND_SAMPLES = [
  [0.2, 0.2],
  [0.8, 0.2],
  [0.2, 0.8],
  [0.8, 0.8],
  [0.5, 0.5],
];
function sceneGround(model) {
  return groundMask(model.width, model.height, (x, y) =>
    STAND_SAMPLES.every(([dx, dy]) =>
      model.canStand((x + dx) * TILE, (y + dy) * TILE),
    ),
  );
}
/** La máscara de una pantalla del catálogo. Es el único camino, para que no haya dos. */
function catalogGround(catalog, scene) {
  const data = catalog.scenes[scene];
  if (!data) throw Error("Pantalla desconocida: " + scene);
  // A communal movable's authored home is not permanent terrain. Its current footprint
  // comes from the live authority; otherwise moving it would leave an invisible hole.
  return sceneGround(new World({ ...data, entities: data.entities.filter(e => e.shared !== true) }));
}
module.exports = { catalogGround };
