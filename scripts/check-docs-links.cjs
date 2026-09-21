"use strict";
/**
 * ⛔ LA DOCUMENTACIÓN SE PUDRE EN SILENCIO (21-sep-2026).
 *
 * En el repaso completo aparecieron catorce enlaces internos rotos repartidos por cuatro ficheros:
 * una sección entera de `ART.md` pegada desde el README de su carpeta con los relativos de AQUELLA
 * carpeta (doce láminas y una galería), un `ROWING-ART.md` que mandaba a un README borrado, y dos
 * anclas de `RELEASE.md` que seguían apuntando a títulos con la fecha vieja después de renombrarlos.
 * Ninguna prueba lo notó porque ninguna leía la documentación: se descubrió a mano, tarde, y el
 * coste real no es el enlace sino el agente o la persona que sigue el hilo y no encuentra el porqué
 * de una decisión.
 *
 * Esta prueba recorre TODOS los `.md` versionados y exige dos cosas de cada enlace interno:
 * el fichero existe, y —si lleva `#`— ese título existe en el fichero de destino. No toca la red:
 * los `http(s)` y los `mailto:` se dejan pasar a propósito, porque un enlace externo caído no es
 * un fallo de este repositorio y una prueba que depende de internet no es una prueba.
 */
const assert = require("node:assert/strict"),
  { execFileSync } = require("node:child_process"),
  fs = require("node:fs"),
  path = require("node:path");

const root = path.resolve(__dirname, "..");
const files = execFileSync("git", ["ls-files", "*.md"], { cwd: root, encoding: "utf8" })
  .split("\n")
  .filter(Boolean);

/**
 * El ancla que fabrica GitHub: minúsculas, fuera todo lo que no sea letra, número, espacio o guion
 * —y las letras acentuadas SÍ cuentan, que media documentación está en español— y los espacios a
 * guiones. `\p{L}\p{N}` con la bandera `u` evita tener que enumerar la ñ y las tildes a mano.
 */
const slug = (heading) =>
  heading
    .replace(/^#+\s*/, "")
    .trim()
    .toLowerCase()
    .replace(/[^\p{L}\p{N} \-_]/gu, "")
    .replace(/ /g, "-");

const headings = new Map();
const text = new Map();
for (const file of files) {
  const body = fs.readFileSync(path.join(root, file), "utf8");
  text.set(file, body);
  headings.set(
    file,
    new Set(
      body
        .split("\n")
        .filter((line) => /^#{1,6}\s/.test(line))
        .map(slug),
    ),
  );
}

/** Un enlace markdown que no sea una imagen; las imágenes rotas las cazan las pruebas de arte. */
const LINK = /(?<!!)\[([^\]\n]+)\]\(([^)\s]+)\)/g;
const broken = [];
for (const file of files) {
  const dir = path.dirname(file);
  for (const [, label, target] of text.get(file).matchAll(LINK)) {
    if (/^(https?:|mailto:|#$)/.test(target)) continue;
    const hash = target.indexOf("#");
    const route = hash === -1 ? target : target.slice(0, hash);
    const fragment = hash === -1 ? "" : decodeURIComponent(target.slice(hash + 1));
    const destination = route ? path.normalize(path.join(dir, route)) : file;
    if (route && !fs.existsSync(path.join(root, destination))) {
      broken.push(file + " → " + target + " (no existe el fichero) [" + label + "]");
      continue;
    }
    // Solo se puede contestar por las anclas de un markdown del repositorio.
    if (!fragment || !headings.has(destination)) continue;
    if (!headings.get(destination).has(fragment))
      broken.push(file + " → " + target + " (no existe ese título) [" + label + "]");
  }
}
assert.deepEqual(broken, [], "Enlaces internos rotos en la documentación:\n  " + broken.join("\n  "));

const counted = files.reduce((n, f) => n + [...text.get(f).matchAll(LINK)].length, 0);
console.log(
  "PASS enlaces de la documentación: " +
    files.length +
    " ficheros, " +
    counted +
    " enlaces, " +
    [...headings.values()].reduce((n, s) => n + s.size, 0) +
    " títulos anclables; ninguno apunta al vacío.",
);
