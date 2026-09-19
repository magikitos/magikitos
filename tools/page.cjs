"use strict";
const fs = require("node:fs"),
  path = require("node:path");
/**
 * Las rutas del ARTEFACTO en la web (19-sep-2026, decisión del dueño: «no se llamará
 * /aventura, se llamará /bosque»). `/bosque` y sus traducciones son la landing de la web, una
 * página normal que explica qué es esto; el juego cuelga debajo, en `explorar`, y es lo que
 * la web sirve estático antes de su bootstrap (`src/game-release.php`). La misma tabla viaja
 * en `release.json` y `current.json`, así que cambiarla aquí cambia lo que la web monta.
 */
const ROUTES = Object.freeze({
  es: "/bosque/explorar",
  en: "/en/forest/explore",
  de: "/de/wald/erkunden",
  fr: "/fr/foret/explorer",
  it: "/it/bosco/esplora",
  pt: "/pt/floresta/explorar",
});
const NAMES = {
  es: "Español",
  en: "English",
  de: "Deutsch",
  fr: "Français",
  it: "Italiano",
  pt: "Português",
};
const escape = (value) =>
  String(value ?? "").replace(
    /[&<>"']/g,
    (c) =>
      ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" })[
        c
      ],
  );
function page(config, prefix) {
  const values = { ...config.strings, locale: config.locale, prefix };
  const raw = {
    configuration: JSON.stringify(config).replaceAll("<", "\\u003c"),
    languageOptions: Object.entries(config.routes || ROUTES)
      .map(
        ([locale, route]) =>
          '<option value="' +
          route +
          '"' +
          (locale === config.locale ? " selected" : "") +
          ">" +
          NAMES[locale] +
          "</option>",
      )
      .join(""),
  };
  return fs
    .readFileSync(path.resolve(__dirname, "../public/game.html"), "utf8")
    .replace(/{{(\w+)}}/g, (_, key) => {
      if (key in raw) return raw[key];
      if (!(key in values)) throw Error("Missing page copy: " + key);
      return escape(values[key]);
    });
}
module.exports = { page, ROUTES };
