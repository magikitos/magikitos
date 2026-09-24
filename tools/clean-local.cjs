"use strict";
/**
 * ⛔ LAS HERRAMIENTAS DEL JUEGO RECOGEN LO QUE DEJAN (24-sep-2026, el dueño: «las pruebas con
 * headless chrome me están llenando el mac de clones de chrome»).
 *
 * Tres cosas crecen solas en la máquina de quien desarrolla, y las tres las crean estas herramientas:
 *
 *  1. Las COPIAS DE CHROME. En macOS, cada vez que una prueba lanza Google Chrome
 *     (`channel: "chrome"`), Chrome se copia a sí mismo en `…/X/com.google.Chrome.code_sign_clone/`
 *     y la borra al salir; si el proceso muere de golpe (una prueba que revienta, un timeout), la
 *     copia se queda. Se llegaron a juntar 22. Se borran las que ningún proceso tiene abiertas y
 *     llevan más de diez minutos quietas: el Chrome de la persona y una prueba en marcha usan la suya.
 *  2. Las carpetas temporales de las pruebas (`magikitos-*` y los perfiles de Playwright) en el
 *     directorio temporal del sistema, pasado un día.
 *  3. Los artefactos de `.local/build/releases`: cada build deja uno nuevo (~90 MB). Se conservan
 *     el que está publicado en la web local y los tres más nuevos.
 *
 * NO toca nada más del ordenador. Corre al final de `npm test`, al construir, y con `npm run clean`.
 */
const fs = require("node:fs"),
  os = require("node:os"),
  path = require("node:path"),
  cp = require("node:child_process");

const MINUTE = 60 * 1000;
const root = path.resolve(__dirname, "..");

function remove(target) {
  try {
    const bytes = sizeOf(target);
    fs.rmSync(target, { recursive: true, force: true });
    return bytes;
  } catch (_) {
    return 0;
  }
}
function sizeOf(target) {
  try {
    const stat = fs.lstatSync(target);
    if (!stat.isDirectory()) return stat.size;
    return fs.readdirSync(target).reduce((sum, name) => sum + sizeOf(path.join(target, name)), 0);
  } catch (_) {
    return 0;
  }
}
const age = (target) => {
  try {
    return Date.now() - fs.statSync(target).mtimeMs;
  } catch (_) {
    return 0;
  }
};

/** Chrome's per-launch app copies that no running process holds open. macOS only. */
function chromeClones() {
  if (process.platform !== "darwin") return [];
  let temp;
  try {
    temp = cp.execFileSync("getconf", ["DARWIN_USER_TEMP_DIR"], { encoding: "utf8" }).trim();
  } catch (_) {
    return [];
  }
  const dir = path.join(path.dirname(temp.replace(/\/$/, "")), "X", "com.google.Chrome.code_sign_clone");
  if (!fs.existsSync(dir)) return [];
  let open = "";
  try {
    open = cp.execFileSync("lsof", ["-Fn"], { encoding: "utf8", maxBuffer: 256 * 1024 * 1024, stdio: ["ignore", "pipe", "ignore"] });
  } catch (error) {
    open = error.stdout || "";
    // Without knowing what is open, nothing is removed: a clone in use would break that Chrome.
    if (!open) return [];
  }
  const inUse = new Set(open.match(/code_sign_clone\.[A-Za-z0-9]+/g) || []);
  return fs
    .readdirSync(dir)
    .filter((name) => name.startsWith("code_sign_clone.") && !inUse.has(name))
    .map((name) => path.join(dir, name))
    .filter((target) => age(target) > 10 * MINUTE);
}

/** The tests' own scratch folders in the system temp directory, older than a day. */
function testTemp() {
  const dir = os.tmpdir();
  let names = [];
  try {
    names = fs.readdirSync(dir);
  } catch (_) {
    return [];
  }
  return names
    .filter((name) => /^(magikitos-|playwright_chromiumdev_profile-|playwright-artifacts-)/.test(name))
    .map((name) => path.join(dir, name))
    .filter((target) => age(target) > 24 * 60 * MINUTE);
}

/** Old local build artefacts: keep what the local website points at and the three newest. */
function oldBuilds() {
  const dir = path.join(root, ".local/build/releases");
  if (!fs.existsSync(dir)) return [];
  const keep = new Set();
  try {
    keep.add(JSON.parse(fs.readFileSync(path.join(root, "../magikitos/public/game/current.json"), "utf8")).id);
  } catch (_) {}
  try {
    keep.add(JSON.parse(fs.readFileSync(path.join(root, ".local/build/current.json"), "utf8")).id);
  } catch (_) {}
  const builds = fs
    .readdirSync(dir)
    .map((name) => path.join(dir, name))
    .filter((target) => fs.statSync(target).isDirectory())
    .sort((a, b) => age(a) - age(b));
  builds.slice(0, 3).forEach((target) => keep.add(path.basename(target)));
  return builds.filter((target) => !keep.has(path.basename(target)));
}

function cleanLocal({ quiet = false } = {}) {
  const groups = { "Chrome copies": chromeClones(), "test temp": testTemp(), "old builds": oldBuilds() };
  const report = [];
  for (const [label, targets] of Object.entries(groups)) {
    if (!targets.length) continue;
    const bytes = targets.reduce((sum, target) => sum + remove(target), 0);
    report.push(`${targets.length} ${label} (${(bytes / 1e6).toFixed(0)} MB)`);
  }
  if (!quiet) console.log(report.length ? "Cleaned: " + report.join(", ") : "Clean: nothing to remove");
  return report;
}

module.exports = { cleanLocal };
if (require.main === module) cleanLocal();
