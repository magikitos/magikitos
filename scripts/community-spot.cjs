"use strict";
const {
  validateConstruction,
} = require("../public/assets/js/adventure/construction-layout");

/**
 * ⛔ UN SITIO LEGAL SE BUSCA, NO SE ESCRIBE A MANO.
 *
 * El dueño mueve las cosas en el Estudio, y una prueba con un par de coordenadas dentro se cae
 * por tiempo señalando al sitio equivocado: falla el día que alguien empuja un banco un cuarto de
 * casilla y el informe habla de la regla, no de la mudanza. Así que se pregunta por el primer
 * tile con suelo firme a la redonda y lejos de lo prohibido, y ahí se prueba de verdad.
 *
 * El filtro barato va delante a propósito: validar de verdad cuesta un relleno por inundación de
 * la pantalla entera, y a media casilla por paso eso son decenas de miles de rellenos para
 * encontrar el primer hueco. Con la criba, el primer candidato suele valer.
 */
function freeSpot({ catalog, zone, ground, make, others = [], radio = 4 }) {
  const protegido = catalog.zones[zone].protected;
  const firme = (x, y) =>
    x >= 0 &&
    y >= 0 &&
    x < ground.width &&
    y < ground.height &&
    ground.cells[y * ground.width + x];
  for (let y = radio; y < ground.height - radio; y++)
    for (let x = radio; x < ground.width - radio; x++) {
      let libre = true;
      for (let dy = -radio; dy <= radio && libre; dy++)
        for (let dx = -radio; dx <= radio && libre; dx++)
          if (!firme(x + dx, y + dy)) libre = false;
      if (!libre) continue;
      if (
        protegido.some(
          ([rx, ry, rw, rh]) =>
            x + radio > rx &&
            x - radio < rx + rw &&
            y + radio > ry &&
            y - radio < ry + rh,
        )
      )
        continue;
      const candidate = make(x, y);
      if (
        !validateConstruction(
          [...others, candidate],
          zone,
          catalog,
          ground,
          candidate.id,
        )
      )
        return candidate;
    }
  return null;
}
module.exports = { freeSpot };
