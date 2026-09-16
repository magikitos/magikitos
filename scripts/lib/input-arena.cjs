"use strict";
/** Un claro vacío en el que medir ENTRADA y no paisaje.
 *
 * ⛔ EL MUNDO DE VERDAD ESTÁ VIVO, Y ESO CONVIERTE UNA PRUEBA DE CONTROLES EN UNA
 * LOTERÍA. Un gato del picnic te coge en brazos y la palanca deja de aceptar gestos
 * a propósito; un cartel abre conversación y la conversación la retira; un vecino se
 * cruza y cambia el camino. Todo eso es correcto en el juego y ninguno de esos casos
 * es lo que se está midiendo, así que la escena se sustituye por un claro con un
 * cartel y nada más. Costó encontrarlo: la prueba de modalidad fallaba en un punto
 * distinto en cada pasada, siempre con la palanca visible y sin culpa aparente.
 *
 * No se envía ninguna escena de prueba ni interfaz de depuración escribible: el
 * código, los gestos, los sprites y la física que corren aquí son los de producción.
 */
const arena = {
  id: "overworld",
  width: 128,
  height: 128,
  seed: 1,
  spawn: { x: 56.25, y: 56.25 },
  paths: [],
  waters: [],
  regions: [],
  clearings: [],
  scenery: [],
  neighbors: [],
  entities: [
    {
      id: "test-sign",
      sprite: "sign",
      x: 62.5,
      y: 57.5,
      solid: [-0.5, -0.5, 1, 1],
      label: "sign",
      rules: [{ effects: [{ type: "dialogue", key: "forestDirections" }] }],
    },
  ],
};

/** Sirve la página de la aventura con el claro dentro de su propio config. */
async function fulfillArena(route) {
  const response = await route.fetch(),
    body = (await response.text()).replace(
      /(<script type="application\/json" id="adventure-config">)([\s\S]*?)(<\/script>)/,
      (_, open, json, close) => {
        const config = JSON.parse(json);
        config.world.scenes.overworld = arena;
        config.neighbors = [];
        config.cast = {};
        return open + JSON.stringify(config).replaceAll("<", "\\u003c") + close;
      },
    );
  return route.fulfill({ response, body });
}

module.exports = { arena, fulfillArena };
