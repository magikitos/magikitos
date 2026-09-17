"use strict";
/**
 * LO QUE DICE UNA PANTALLA VIAJA CON LA PANTALLA.
 *
 * El motor lleva sus textos incrustados en la página (menús, botones, el nombre de lo que llevas
 * en el saco). Todo lo demás —cada cartel, cada vecino, cada receta— vive en un fichero por
 * pantalla y por idioma que se pide junto a sus sprites, en `SceneDirector.prepare()`. Un bosque
 * con cien pantallas no carga más que uno con diez.
 *
 * Se piden por el MISMO camino que el arte, y eso no es casualidad: si los sprites de una escena
 * pueden llegar, sus frases también, y si no llegan ninguno de los dos, la llegada falla entera y
 * el jugador se queda donde estaba con su barca y su saco intactos. No hay estado a medias en el
 * que una pantalla se pinte con los nombres de las claves.
 *
 * La caché no caduca: son unos kilobytes por pantalla y el idioma de una página no cambia sin
 * recargarla. La pantalla de arranque llega ya sembrada desde la página (`config.sceneStrings`),
 * así que la primera entrada al bosque no espera a nadie.
 */
class SceneText {
  constructor(config) {
    this.base = config.localeBase || "";
    this.cache = new Map(Object.entries(config.sceneStrings || {}));
    this.pending = new Map();
  }
  /** Lo que ya está en memoria, sin pedir nada. */
  peek(scene) {
    return this.cache.get(scene) || null;
  }
  /**
   * Una petición por pantalla aunque la pidan a la vez la llegada y el precalentado: sin esto,
   * acercarse a una puerta mientras se cruza dispara dos descargas del mismo fichero.
   */
  load(scene) {
    const ready = this.cache.get(scene);
    if (ready) return Promise.resolve(ready);
    const flight = this.pending.get(scene);
    if (flight) return flight;
    const task = fetch(this.base + scene + ".json", { cache: "force-cache" })
      .then((response) => {
        if (!response.ok) throw Error("Scene copy " + response.status + ": " + scene);
        return response.json();
      })
      .then((strings) => {
        this.cache.set(scene, strings);
        return strings;
      })
      .finally(() => this.pending.delete(scene));
    this.pending.set(scene, task);
    return task;
  }
}
module.exports = { SceneText };
