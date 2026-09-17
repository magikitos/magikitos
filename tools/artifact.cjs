"use strict";
/** Immutable, allowlisted static release verification, shared by build and local installation. */
const fs = require("node:fs"),
  path = require("node:path"),
  crypto = require("node:crypto");
const { ROUTES } = require("./page.cjs");
function inventory(base, dir = "") {
  return fs
    .readdirSync(path.join(base, dir))
    .sort()
    .flatMap((name) => {
      const rel = path.posix.join(dir, name),
        stat = fs.lstatSync(path.join(base, rel));
      if (stat.isSymbolicLink() || (!stat.isDirectory() && !stat.isFile()))
        throw Error("Non-regular artifact entry: " + rel);
      return stat.isDirectory() ? inventory(base, rel) : [rel];
    });
}
const digest = (file) =>
  crypto.createHash("sha256").update(fs.readFileSync(file)).digest("hex");
function verify(directory, id) {
  const manifest = JSON.parse(
    fs.readFileSync(path.join(directory, "release.json")),
  );
  if (
    !/^[a-f0-9]{20}$/.test(id) ||
    manifest.id !== id ||
    JSON.stringify(manifest.routes) !== JSON.stringify(ROUTES)
  )
    throw Error("Invalid release contract");
  const actual = inventory(directory).filter((p) => p !== "release.json"),
    expected = Object.keys(manifest.files || {}).sort();
  if (JSON.stringify(actual) !== JSON.stringify(expected))
    throw Error("Unexpected or missing artifact files");
  for (const rel of expected) {
    if (
      !/^(game-contract\.json|pages\/(es|en|de|fr|it|pt)\.html|assets\/(audio\/(catalog\.json|[a-f0-9]{32}\.mp3)|js\/[a-z.-]+\.js|css\/[a-z.-]+\.css|locales\/(es|en|de|fr|it|pt)\/[a-z0-9-]+\.json|fonts\/[\w.-]+\.(woff2|txt)|aventura\/(manifest\.json|packs\/[a-z0-9-]+\.(json|png))))$/.test(
        rel,
      )
    )
      throw Error("Not a public game asset: " + rel);
    if (digest(path.join(directory, rel)) !== manifest.files[rel])
      throw Error("Artifact checksum failed: " + rel);
  }
  for (const lang of Object.keys(ROUTES))
    if (!expected.includes("pages/" + lang + ".html"))
      throw Error("Missing locale");
  // Lo que dice cada pantalla viaja en su propio fichero, y los seis idiomas llevan exactamente
  // las mismas pantallas: publicar una escena que solo habla castellano sería publicar un rincón
  // donde el resto del mundo lee nombres de claves.
  const byLang = Object.fromEntries(Object.keys(ROUTES).map((lang) => [lang, []]));
  for (const rel of expected) {
    const match = rel.match(/^assets\/locales\/([a-z]{2})\/(.+)\.json$/);
    if (match) byLang[match[1]].push(match[2]);
  }
  const reference = JSON.stringify(byLang[Object.keys(ROUTES)[0]].sort());
  if (reference === "[]") throw Error("Release without scene copy");
  for (const lang of Object.keys(ROUTES))
    if (JSON.stringify(byLang[lang].sort()) !== reference)
      throw Error("Scene copy missing for " + lang);
  return manifest;
}
module.exports = { inventory, digest, verify };
