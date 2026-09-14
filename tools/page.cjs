"use strict";
const fs = require("node:fs"),
  path = require("node:path");
const ROUTES = Object.freeze({
  es: "/aventura",
  en: "/en/adventure",
  de: "/de/abenteuer",
  fr: "/fr/aventure",
  it: "/it/avventura",
  pt: "/pt/aventura",
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
    languageOptions: Object.entries(ROUTES)
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
